from motor.motor_asyncio import AsyncIOMotorClient
from config import MONGODB_URI

# Create MongoDB client
client = AsyncIOMotorClient(MONGODB_URI)
db = client.test  # database name

# Collections
users = db.users
courses = db.courses
attendance = db.attendance
qrcodes = db.qrcodes
resources = db.resources
enrollments = db.enrollments