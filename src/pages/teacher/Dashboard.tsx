import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/axios';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { QrCode, Upload, LogOut, Book, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [qrCode, setQrCode] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [resources, setResources] = useState([]);

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetchAttendanceReport(selectedCourse._id);
      fetchResources(selectedCourse._id);
    }
  }, [selectedCourse]);

  const fetchCourses = async () => {
    try {
      const response = await api.get('/courses/teacher');
      setCourses(response.data);
      if (response.data.length > 0) {
        setSelectedCourse(response.data[0]);
      }
    } catch (error) {
      toast.error('Failed to fetch courses');
    }
  };

  const fetchAttendanceReport = async (courseId) => {
    try {
      const response = await api.get(`/attendance/teacher/${courseId}`);
      setAttendanceData(response.data);
    } catch (error) {
      toast.error('Failed to fetch attendance report');
    }
  };

  const fetchResources = async (courseId) => {
    try {
      const response = await api.get(`/resources/${courseId}`);
      setResources(response.data);
    } catch (error) {
      toast.error('Failed to fetch resources');
    }
  };

  const generateQRCode = async () => {
    if (!selectedCourse) {
      toast.error('No course selected');
      return;
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      const response = await api.post(
        `/attendance/teacher/generate-qr/${selectedCourse._id}`,
        location,
        { responseType: 'arraybuffer' }
      );

      const base64Data = btoa(
        new Uint8Array(response.data).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      );
      setQrCode(`data:image/png;base64,${base64Data}`);
      setShowQR(true);
    } catch (error) {
      toast.error('Failed to generate QR code');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !selectedCourse) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post(`/resources/${selectedCourse._id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      toast.success('Resource uploaded successfully');
      fetchResources(selectedCourse._id);
    } catch (error) {
      toast.error('Failed to upload resource');
    }
  };

  const handleDeleteResource = async (resourceId) => {
    try {
      await api.delete(`/resources/${selectedCourse._id}/${resourceId}`);
      toast.success('Resource deleted successfully');
      fetchResources(selectedCourse._id);
    } catch (error) {
      toast.error('Failed to delete resource');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Book className="w-8 h-8 text-indigo-600" />
              <span className="ml-2 text-xl font-semibold">Teacher Dashboard</span>
            </div>
            <div className="flex items-center">
              <span className="mr-4">Welcome, {user?.firstName}</span>
              <button
                onClick={logout}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <LogOut className="w-5 h-5 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Course Selection</h2>
            <select
              value={selectedCourse?._id || ''}
              onChange={(e) => setSelectedCourse(courses.find((c) => c._id === e.target.value))}
              className="w-full border rounded-md p-2"
            >
              {courses.map((course) => (
                <option key={course._id} value={course._id}>
                  {course.name}
                </option>
              ))}
            </select>

            <div className="mt-6 space-x-4">
              <button
                onClick={generateQRCode}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md"
              >
                <QrCode className="inline-block mr-2" />
                Generate QR Code
              </button>
              <label className="cursor-pointer px-4 py-2 bg-green-600 text-white rounded-md">
                <Upload className="inline-block mr-2" />
                Upload Resource
                <input type="file" hidden onChange={handleFileUpload} />
              </label>
            </div>
            {showQR && qrCode && <img src={qrCode} alt="QR Code" className="mt-6 mx-auto" />}
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Attendance Overview</h2>
            {attendanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={attendanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="studentName" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="attendedClasses" fill="#4F46E5" />
                  <Bar dataKey="totalClasses" fill="#9333EA" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p>No attendance data available</p>
            )}
          </div>

          <div className="bg-white shadow rounded-lg p-6 md:col-span-2">
            <h2 className="text-lg font-medium mb-4">Course Resources</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {resources.map((resource) => (
                <div
                  key={resource._id}
                  className="border rounded-md p-4 shadow hover:shadow-lg flex justify-between"
                >
                  <a href={resource.url} target="_blank" rel="noopener noreferrer">
                    <p className="text-sm font-medium">{resource.title}</p>
                    <p className="text-xs text-gray-500">
                      Uploaded: {new Date(resource.uploadedAt).toLocaleDateString()}
                    </p>
                  </a>
                  <button
                    onClick={() => handleDeleteResource(resource._id)}
                    className="text-red-600"
                  >
                    <Trash2 />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
