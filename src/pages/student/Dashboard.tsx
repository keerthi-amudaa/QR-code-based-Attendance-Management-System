import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../lib/axios';
import { Html5QrcodeScanner } from 'html5-qrcode';
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
import { QrCode, Upload, LogOut, Book, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Chatbot from './Chatbot'; // Import the Chatbot component

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [resources, setResources] = useState([]);

  useEffect(() => {
    fetchCourses();
    return () => {
      if (showScanner) {
        const scanner = document.getElementById('reader');
        if (scanner) {
          scanner.innerHTML = '';
        }
      }
    };
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetchAttendanceReport(selectedCourse._id);
      fetchResources(selectedCourse._id);
    }
  }, [selectedCourse]);

  useEffect(() => {
    if (showScanner) {
      const scanner = new Html5QrcodeScanner('reader', {
        qrbox: {
          width: 250,
          height: 250,
        },
        fps: 5,
      });

      scanner.render(handleScan, handleScanError);

      return () => {
        scanner.clear();
      };
    }
  }, [showScanner]);

  const fetchCourses = async () => {
    try {
      const response = await api.get('/courses/student');
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
      const response = await api.get(`/attendance/student/${courseId}`);
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

  const handleScan = async (decodedText) => {
    try {
      // Get current location
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        });
      });

      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      // Send attendance data to server
      // The decodedText is already the string representation of the QR data object
      await api.post('/attendance/student/mark-attendance', {
        qrData: decodedText, // Send the raw string from QR code
        location, // Send current device location
      });

      toast.success('Attendance marked successfully');
      setShowScanner(false);
      
      // Refresh attendance data if a course is selected
      if (selectedCourse) {
        fetchAttendanceReport(selectedCourse._id);
      }
    } catch (error) {
      console.error('Attendance marking error:', error);
      if (error.name === 'GeolocationPositionError') {
        toast.error('Unable to get location. Please enable location services.');
      } else if (error.response?.data?.detail) {
        toast.error(error.response.data.detail);
      } else {
        toast.error('Failed to mark attendance. Please try again.');
      }
    }
  };

  const handleScanError = (error) => {
    // Only log scanning errors, don't show to user unless it's a permission issue
    if (error.name === 'NotAllowedError') {
      toast.error('Camera access denied. Please enable camera permissions.');
    }
  };

  const getAttendanceChartData = () => {
    if (!attendanceData) return [];
    return [
      {
        name: 'Classes',
        attended: attendanceData.attendedClasses,
        total: attendanceData.totalClasses,
      },
    ];
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Book className="w-8 h-8 text-indigo-600" />
              <span className="ml-2 text-xl font-semibold">Student Dashboard</span>
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
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Course Selection</h2>
                <select
                  value={selectedCourse?._id}
                  onChange={(e) => {
                    const course = courses.find((c) => c._id === e.target.value);
                    setSelectedCourse(course);
                  }}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  {courses.map((course) => (
                    <option key={course._id} value={course._id}>
                      {course.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setShowScanner(!showScanner)}
                  className="mt-6 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <QrCode className="w-5 h-5 mr-2" />
                  {showScanner ? 'Close Scanner' : 'Scan QR Code'}
                </button>

                {showScanner && (
                  <div className="mt-6">
                    <div id="reader"></div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Attendance Overview</h2>
                {attendanceData && (
                  <>
                    <div className="mb-6">
                      <p className="text-sm text-gray-500">
                        Classes Attended: {attendanceData.attendedClasses} / {attendanceData.totalClasses}
                      </p>
                      <p className="text-lg font-semibold text-indigo-600">
                        Attendance: {attendanceData.percentage.toFixed(2)}%
                      </p>
                    </div>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getAttendanceChartData()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="attended" fill="#4F46E5" name="Classes Attended" />
                          <Bar dataKey="total" fill="#9333EA" name="Total Classes" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg md:col-span-2">
              <div className="p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Course Resources</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {resources.map((resource) => (
                    <div
                      key={resource._id}
                      className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400"
                    >
                      <div className="flex-shrink-0">
                        <FileText className="h-6 w-6 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="focus:outline-none"
                        >
                          <p className="text-sm font-medium text-gray-900">{resource.title}</p>
                          <p className="text-sm text-gray-500 truncate">
                            Uploaded: {new Date(resource.uploadedAt).toLocaleDateString()}
                          </p>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add Chatbot component */}
      <Chatbot attendanceData={attendanceData} />
    </div>
  );
}