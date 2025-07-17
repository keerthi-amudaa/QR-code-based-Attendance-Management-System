import os
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import List, Optional, Dict
import bcrypt
import uuid
from dotenv import load_dotenv
from pathlib import Path

# Add this after app initialization

import qrcode
from io import BytesIO
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
#app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
# MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL")  # MongoDB Atlas connection string from .env
client = AsyncIOMotorClient(MONGODB_URL)
db = client.test


UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# To serve files from the 'uploads' directory
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
# Check if the connection is successful
try:
    client.admin.command('ping')  # Simple ping to check if MongoDB is reachable
    print("MongoDB connection successful!")
except Exception as e:
    print(f"MongoDB connection failed: {e}")

# Models
class Location(BaseModel):
    latitude: float
    longitude: float

class User(BaseModel):
    email: str
    password: str
    firstName: str
    lastName: str
    role: str  # "student" or "teacher"
    department: str
    usn: Optional[str] = None

class LoginData(BaseModel):
    email: str
    password: str

class QRData(BaseModel):
    courseId: str
    location: Location

class AttendanceData(BaseModel):
    qrData: str
    location: Location

# Auth middleware
async def get_current_user(token: str):
    user = await db.users.find_one({"token": token})
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user

def check_location_proximity(loc1: Location, loc2: Location, threshold_meters: float = 100) -> bool:
    lat_diff = abs(loc1.latitude - loc2.latitude)
    lon_diff = abs(loc1.longitude - loc2.longitude)
    distance_meters = ((lat_diff ** 2 + lon_diff ** 2) ** 0.5) * 111000
    return distance_meters <= threshold_meters

# Auth routes
@app.post("/auth/register")
async def register(user: User):
    try:
        # Check if the user already exists
        existing_user = await db.users.find_one({"email": user.email})
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")

        # Generate a unique USN if not provided
        usn = user.usn if user.usn else str(uuid.uuid4())

        # Hash the password
        hashed_password = bcrypt.hashpw(user.password.encode(), bcrypt.gensalt())

        # Create user dictionary
        user_dict = user.dict()
        user_dict["password"] = hashed_password
        user_dict["_id"] = str(uuid.uuid4())
        user_dict["usn"] = usn  # Ensure USN is set

        # Insert user into the database
        await db.users.insert_one(user_dict)

        if user.role == "teacher":
            # Assign a single course for the teacher
            course = {
                "_id": str(uuid.uuid4()),
                "name": f"Course for {user.firstName} {user.lastName}",
                "teacherId": user_dict["_id"],
                "department": user.department,
                "createdAt": datetime.utcnow()
            }
            await db.courses.insert_one(course)

        elif user.role == "student":
            # Enroll the student in courses based on the department
            courses_in_department = await db.courses.find({"department": user.department}).to_list(None)
            enrollments = [
                {
                    "_id": str(uuid.uuid4()),
                    "courseId": course["_id"],
                    "studentId": user_dict["_id"],
                    "enrolledAt": datetime.utcnow()
                }
                for course in courses_in_department
            ]
            if enrollments:
                await db.enrollments.insert_many(enrollments)

        return {"message": "User registered successfully"}
    except Exception as e:
        print(f"Error in registration: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

@app.post("/auth/login")
async def login(data: LoginData):
    user = await db.users.find_one({"email": data.email})
    if not user or not bcrypt.checkpw(data.password.encode(), user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = str(uuid.uuid4())
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"token": token}})
    return {
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "email": user["email"],
            "firstName": user["firstName"],
            "lastName": user["lastName"],
            "role": user["role"],
        },
    }

# Course routes
@app.get("/courses/teacher")
async def get_teacher_courses(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
    courses = await db.courses.find({"teacherId": str(current_user["_id"])}).to_list(None)
    if not courses:
        raise HTTPException(status_code=404, detail="No courses found for this teacher")
    return courses

@app.get("/courses/student")
async def get_student_courses(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Not authorized")

    # Fetch all courses in the student's department
    courses = await db.courses.find({"department": current_user["department"]}).to_list(None)

    if not courses:
        raise HTTPException(status_code=404, detail="No courses found for this student")

    # Fetch enrollments to check which courses the student is enrolled in
    enrollments = await db.enrollments.find({"studentId": str(current_user["_id"])}).to_list(None)
    enrolled_course_ids = [enrollment["courseId"] for enrollment in enrollments]

    for course in courses:
        if course["_id"] in enrolled_course_ids:
            course["enrolled"] = True
        else:
            # Auto-enroll the student in courses they aren't enrolled in
            new_enrollment = {
                "_id": str(uuid.uuid4()),
                "courseId": course["_id"],
                "studentId": str(current_user["_id"]),
                "enrolledAt": datetime.utcnow()
            }
            await db.enrollments.insert_one(new_enrollment)
            course["enrolled"] = True

    return courses



@app.post("/attendance/teacher/generate-qr/{course_id}")
async def generate_qr_code(course_id: str, location: Location, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")

    course = await db.courses.find_one({"_id": course_id, "teacherId": str(current_user["_id"])})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found or not assigned to you")

    # Update the total number of classes for the course
    total_classes = course.get("totalClasses", 0) + 1
    await db.courses.update_one(
        {"_id": course_id},
        {"$set": {"totalClasses": total_classes}}
    )

    qr_data = {
        "courseId": course_id,
        "latitude": location.latitude,
        "longitude": location.longitude,
        "generatedAt": datetime.utcnow().isoformat(),
    }

    # Generate QR code
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill="black", back_color="white")

    # Stream QR code as response
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)

    return StreamingResponse(buffer, media_type="image/png")

@app.post("/attendance/student/mark-attendance")
async def mark_attendance(data: AttendanceData, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Not authorized")

    # Check if student has already marked attendance in the last 60 minutes
    last_attendance = await db.attendance.find_one({
            "studentId": str(current_user["_id"]),
            "markedAt": {
            "$gte": datetime.utcnow() - timedelta(minutes=60)
        }
    })

    if last_attendance:
        raise HTTPException(
            status_code=400, 
            detail="You can only mark attendance once every 60 minutes"
        )

    # Rest of your existing mark_attendance code...
    try:
        qr_data = eval(data.qrData)
        course_id = qr_data["courseId"]
        qr_latitude = qr_data["latitude"]
        qr_longitude = qr_data["longitude"]
        generated_at = datetime.fromisoformat(qr_data["generatedAt"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid QR data: {str(e)}")

    if datetime.utcnow() - generated_at > timedelta(minutes=30):
        raise HTTPException(status_code=400, detail="QR code expired")

    course = await db.courses.find_one({"_id": course_id})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    enrollment = await db.enrollments.find_one({
        "courseId": course_id,
        "studentId": str(current_user["_id"])
    })
    if not enrollment:
        raise HTTPException(
            status_code=403,
            detail="You are not enrolled in this course"
        )

    if not check_location_proximity(
        data.location,
        Location(latitude=qr_latitude, longitude=qr_longitude)
    ):
        raise HTTPException(
            status_code=400,
            detail="You are not within the allowed proximity to mark attendance"
        )

    attendance_record = {
        "_id": str(uuid.uuid4()),
        "courseId": course_id,
        "studentId": str(current_user["_id"]),
        "markedAt": datetime.utcnow(),
        "location": {
            "latitude": data.location.latitude,
            "longitude": data.location.longitude
        },
    }
    await db.attendance.insert_one(attendance_record)

    return {"message": "Attendance marked successfully"}

# Attendance routes
@app.get("/attendance/student/{course_id}")
async def get_student_attendance_report(course_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "student":
        raise HTTPException(status_code=403, detail="Not authorized")

    # Fetch the course to ensure it exists and belongs to the student's department
    course = await db.courses.find_one({"_id": course_id, "department": current_user["department"]})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Ensure totalClasses exists and is updated correctly
    if "totalClasses" not in course:
        await db.courses.update_one({"_id": course_id}, {"$set": {"totalClasses": 0}})
        course["totalClasses"] = 0

    # Fetch student's attendance records for the course
    attendance_records = await db.attendance.find({"studentId": str(current_user["_id"]), "courseId": course_id}).to_list(None)

    # Calculate attendance percentage
    total_classes = course.get("totalClasses", 0)  # Fetch totalClasses from the course document
    attended_classes = len(attendance_records)
    percentage = (attended_classes / total_classes * 100) if total_classes > 0 else 0

    return {
        "totalClasses": total_classes,
        "attendedClasses": attended_classes,
        "percentage": percentage,
        "attendanceDetails": [
            {"date": record["markedAt"], "location": record["location"]}
            for record in attendance_records
        ],
    }


@app.get("/attendance/teacher/{course_id}")
async def get_attendance_report(course_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")

    # Fetch the course to ensure it exists and belongs to the teacher
    course = await db.courses.find_one({"_id": course_id, "teacherId": str(current_user["_id"])})
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Ensure totalClasses exists and is updated correctly
    if "totalClasses" not in course:
        await db.courses.update_one({"_id": course_id}, {"$set": {"totalClasses": 0}})
        course["totalClasses"] = 0

    enrollments = await db.enrollments.find({"courseId": course_id}).to_list(None)
    report = []

    for enrollment in enrollments:
        student = await db.users.find_one({"_id": enrollment["studentId"]})
        attendance_records = await db.attendance.find({"studentId": enrollment["studentId"], "courseId": course_id}).to_list(None)

        total_classes = course.get("totalClasses", 0)  # Fetch totalClasses from the course document
        attended_classes = len(attendance_records)
        percentage = (attended_classes / total_classes * 100) if total_classes > 0 else 0

        report.append({
            "studentId": str(student["_id"]),
            "studentName": f"{student['firstName']} {student['lastName']}",
            "totalClasses": total_classes,
            "attendedClasses": attended_classes,
            "percentage": percentage,
        })
    
    return report


# Update the resource upload endpoint to save files
@app.post("/resources/{course_id}")
async def upload_resource(

    course_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")

    # Create course directory if it doesn't exist
    course_dir = UPLOAD_DIR / course_id
    course_dir.mkdir(exist_ok=True)

    # Save the file
    file_path = course_dir / file.filename
    try:
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save file: {str(e)}"
        )

    # Create resource record
    resource = {
        "_id": str(uuid.uuid4()),
        "title": file.filename,
        "type": file.content_type,
        "url": f"/uploads/{course_id}/{file.filename}",
        "courseId": course_id,
        "uploadedBy": str(current_user["_id"]),
        "uploadedAt": datetime.utcnow()
    }

    await db.resources.insert_one(resource)
    return resource

@app.get("/resources/{course_id}")
async def get_resources(course_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] == "teacher":
        course = await db.courses.find_one({"_id": course_id, "teacherId": str(current_user["_id"])})
        if not course:
            raise HTTPException(status_code=403, detail="Not authorized")
    else:
        # Fetch the course to ensure it exists and is in the student's department
        course = await db.courses.find_one({"_id": course_id, "department": current_user["department"]})
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

    resources = await db.resources.find({"courseId": course_id}).to_list(None)
    return resources

# Add new endpoint to delete resources
@app.delete("/resources/{course_id}/{resource_id}")
async def delete_resource(
    course_id: str,
    resource_id: str,
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")

    # Get the resource to find the file path
    resource = await db.resources.find_one({
        "_id": resource_id,
        "courseId": course_id
    })
    
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    # Delete the file
    try:
        file_path = UPLOAD_DIR / course_id / Path(resource["title"])
        if file_path.exists():
            file_path.unlink()
    except Exception as e:
        print(f"Error deleting file: {str(e)}")

    # Delete the resource record
    await db.resources.delete_one({"_id": resource_id})
    return {"message": "Resource deleted successfully"}

@app.get("/")
async def root():
    return {"message": "Welcome to the Attendance System API!"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

