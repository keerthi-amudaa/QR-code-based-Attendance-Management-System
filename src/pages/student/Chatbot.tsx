import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

export default function Chatbot({ attendanceData }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: 'Hello! How can I help you with your attendance?', sender: 'bot' }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = () => {
    if (input.trim() === '') return;
    
    // Add user message
    setMessages([...messages, { text: input, sender: 'user' }]);
    
    // Process the query and generate a response
    const response = generateResponse(input, attendanceData);
    
    // Add a small delay for bot response to feel more natural
    setTimeout(() => {
      setMessages(prev => [...prev, { text: response, sender: 'bot' }]);
    }, 500);
    
    setInput('');
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const generateResponse = (query, attendanceData) => {
    const lowerQuery = query.toLowerCase();
    
    // If no attendance data is available
    if (!attendanceData) {
      return "I can't access your attendance information at the moment. Please try again later or select a course first.";
    }
    
    // Helper function for calculating classes needed to reach target percentage
    const calculateClassesForTarget = (currentAttended, currentTotal, targetPercentage) => {
      // Formula: If we need to attend X more classes to reach P% attendance
      // (currentAttended + X) / (currentTotal + X) = P/100
      // Solving for X: X = (P*currentTotal - 100*currentAttended) / (100 - P)
      
      const numerator = targetPercentage * currentTotal - 100 * currentAttended;
      const denominator = 100 - targetPercentage;
      
      if (denominator <= 0) {
        return Infinity; // Cannot reach 100% or higher
      }
      
      const result = numerator / denominator;
      if (result < 0) {
        return 0; // Already achieved target
      }
      
      return Math.ceil(result);
    };
    
    // Helper function to calculate classes that can be missed
    const calculateMissableClasses = (currentAttended, currentTotal, threshold) => {
      const currentPercentage = (currentAttended / currentTotal) * 100;
      if (currentPercentage < threshold) {
        return -calculateClassesForTarget(currentAttended, currentTotal, threshold); // Return negative to indicate deficit
      }
      
      // How many more classes can we miss while staying at or above the threshold?
      // (currentAttended) / (currentTotal + X) = threshold/100
      // Solve for X: X = (100*currentAttended / threshold) - currentTotal
      const maxTotal = (100 * currentAttended / threshold);
      const canMiss = Math.floor(maxTotal - currentTotal);
      return Math.max(0, canMiss);
    };
    
    // Helper to format percentage values nicely
    const formatPercentage = (value) => {
      return parseFloat(value.toFixed(2));
    };
    
    // Check current attendance percentage
    if (lowerQuery.includes('attendance percentage') || 
        lowerQuery.includes('my attendance') ||
        lowerQuery.match(/percentage|how (am i|i'm) doing/)) {
      const percentage = formatPercentage(attendanceData.percentage);
      return `Your current attendance percentage is ${percentage}%. You've attended ${attendanceData.attendedClasses} out of ${attendanceData.totalClasses} classes.`;
    }
    
    // Calculate leaves without dropping below threshold
    if (lowerQuery.includes('leaves') || 
        lowerQuery.includes('absence') || 
        lowerQuery.includes('absent') ||
        lowerQuery.includes('miss') ||
        lowerQuery.includes('skip') ||
        lowerQuery.includes('how many classes can i miss')) {
      
      // Extract threshold from query or use default
      let threshold = 75; // Default
      const thresholdMatch = lowerQuery.match(/(\d+)%/);
      if (thresholdMatch) {
        threshold = parseInt(thresholdMatch[1]);
      }
      
      const totalClasses = attendanceData.totalClasses;
      const attendedClasses = attendanceData.attendedClasses;
      
      // Calculate how many more classes student can miss
      const maxClassesCanMiss = calculateMissableClasses(attendedClasses, totalClasses, threshold);
      
      if (maxClassesCanMiss < 0) {
        return `You're already below the ${threshold}% attendance threshold. You need to attend ${Math.abs(maxClassesCanMiss)} more classes to reach ${threshold}%.`;
      } else {
        return `You can miss ${maxClassesCanMiss} more classes without dropping below the ${threshold}% attendance requirement.`;
      }
    }
    
    // Future projection - fixed and improved
    if (lowerQuery.includes('if i attend') || 
        (lowerQuery.includes('will') && lowerQuery.includes('percentage')) ||
        lowerQuery.includes('project')) {
      
      let additionalClasses = 0;
      
      // Try to extract a number from the query - improved pattern
      const numbersInQuery = lowerQuery.match(/\b(\d+)\b/);
      if (numbersInQuery) {
        additionalClasses = parseInt(numbersInQuery[1]);
      } else {
        // Default value if no number found
        additionalClasses = 5;
      }
      
      const currentAttended = attendanceData.attendedClasses;
      const totalClasses = attendanceData.totalClasses;
      
      // Calculate new percentage if attending more classes
      const newAttended = currentAttended + additionalClasses;
      const newTotal = totalClasses + additionalClasses;
      const newPercentage = (newAttended / newTotal) * 100;
      
      // Include information about minimum attendance requirements
      const threshold = 75;
      const currentPercentage = attendanceData.percentage;
      
      let thresholdInfo = '';
      if (currentPercentage < threshold && newPercentage >= threshold) {
        thresholdInfo = ` This would bring you above the minimum requirement of ${threshold}%.`;
      } else if (currentPercentage < threshold && newPercentage < threshold) {
        const stillNeeded = calculateClassesForTarget(newAttended, newTotal, threshold);
        thresholdInfo = ` However, you would still need ${stillNeeded} more classes after that to reach the minimum requirement of ${threshold}%.`;
      }
      
      return `If you attend ${additionalClasses} more classes, your attendance would increase from ${formatPercentage(attendanceData.percentage)}% to ${formatPercentage(newPercentage)}%.${thresholdInfo}`;
    }
    
    // Checking if the student is at risk
    if (lowerQuery.includes('at risk') || 
        lowerQuery.includes('danger') ||
        lowerQuery.includes('failing') ||
        (lowerQuery.includes('will') && lowerQuery.includes('pass')) ||
        lowerQuery.includes('minimum')) {
      
      // Extract threshold from query or use default
      let threshold = 75; // Standard passing threshold
      const thresholdMatch = lowerQuery.match(/(\d+)%/);
      if (thresholdMatch) {
        threshold = parseInt(thresholdMatch[1]);
      }
      
      const currentPercentage = attendanceData.percentage;
      
      if (currentPercentage < threshold) {
        const deficit = formatPercentage(threshold - currentPercentage);
        const classesNeeded = calculateClassesForTarget(
          attendanceData.attendedClasses,
          attendanceData.totalClasses,
          threshold
        );
        
        if (classesNeeded === Infinity) {
          return `Your attendance (${formatPercentage(currentPercentage)}%) is ${deficit}% below the minimum requirement of ${threshold}%. Unfortunately, it's mathematically impossible to reach the minimum threshold this semester.`;
        }
        
        return `Your attendance (${formatPercentage(currentPercentage)}%) is ${deficit}% below the minimum requirement of ${threshold}%. You need to attend at least ${classesNeeded} more consecutive classes to reach the minimum requirement.`;
      } else {
        const buffer = formatPercentage(currentPercentage - threshold);
        const canMiss = calculateMissableClasses(attendanceData.attendedClasses, attendanceData.totalClasses, threshold);
        return `You're doing well! Your attendance (${formatPercentage(currentPercentage)}%) is ${buffer}% above the minimum requirement of ${threshold}%. You can miss up to ${canMiss} classes and still meet the minimum requirement.`;
      }
    }
    
    // Classes attended
    if (lowerQuery.includes('classes attended') || 
        lowerQuery.includes('how many classes') ||
        lowerQuery.includes('total classes')) {
      
      return `You've attended ${attendanceData.attendedClasses} out of ${attendanceData.totalClasses} total classes. Your attendance rate is ${formatPercentage(attendanceData.percentage)}%.`;
    }
    
    // Classes missed
    if (lowerQuery.includes('missed') || 
        lowerQuery.includes('absences') ||
        lowerQuery.includes('not attended')) {
      
      const missedClasses = attendanceData.totalClasses - attendanceData.attendedClasses;
      
      return `You've missed ${missedClasses} out of ${attendanceData.totalClasses} total classes. Your absence rate is ${formatPercentage(100 - attendanceData.percentage)}%.`;
    }
    
    // Required attendance to reach a target - IMPROVED CALCULATION
    if ((lowerQuery.includes('reach') || lowerQuery.includes('achieve') || lowerQuery.includes('get to')) && 
        lowerQuery.match(/\d+%/) ||
        (lowerQuery.includes('need') && lowerQuery.includes('to attend'))) {
      
      // Extract target percentage
      let targetPercentage = 75; // Default target
      const percentageMatch = lowerQuery.match(/(\d+)%/);
      if (percentageMatch) {
        targetPercentage = parseInt(percentageMatch[1]);
      }
      
      const currentAttended = attendanceData.attendedClasses;
      const currentTotal = attendanceData.totalClasses;
      const currentPercentage = attendanceData.percentage;
      
      if (currentPercentage >= targetPercentage) {
        return `You've already achieved ${formatPercentage(currentPercentage)}%, which is above your target of ${targetPercentage}%!`;
      }
      
      // Use the helper function for accurate calculation
      const classesNeeded = calculateClassesForTarget(currentAttended, currentTotal, targetPercentage);
      
      if (classesNeeded === Infinity) {
        return `It's mathematically impossible to reach ${targetPercentage}% with your current attendance record. The maximum possible percentage you can achieve is ${formatPercentage((currentAttended + 500) / (currentTotal + 500) * 100)}% (even if you attend 500 more classes).`;
      }
      
      const newAttendance = (currentAttended + classesNeeded) / (currentTotal + classesNeeded) * 100;
      
      return `To reach ${targetPercentage}%, you need to attend ${classesNeeded} more consecutive classes without missing any. This would increase your attendance from ${formatPercentage(currentPercentage)}% to approximately ${formatPercentage(newAttendance)}%.`;
    }
    
    // What if I miss classes - IMPROVED with more detailed analysis
    if ((lowerQuery.includes('miss') || lowerQuery.includes('skip')) && 
        lowerQuery.match(/\d+/)) {
      
      // Extract number of classes to miss
      let classesToMiss = 1; // Default
      const numbersMatch = lowerQuery.match(/\b(\d+)\b/);
      if (numbersMatch) {
        classesToMiss = parseInt(numbersMatch[1]);
      }
      
      const currentAttended = attendanceData.attendedClasses;
      const currentTotal = attendanceData.totalClasses;
      const currentPercentage = attendanceData.percentage;
      const newPercentage = (currentAttended / (currentTotal + classesToMiss)) * 100;
      
      const difference = currentPercentage - newPercentage;
      
      // Check against threshold
      let threshold = 75;
      const thresholdMatch = lowerQuery.match(/(\d+)%/);
      if (thresholdMatch) {
        threshold = parseInt(thresholdMatch[1]);
      }
      
      const isRisky = newPercentage < threshold;
      let riskMessage = '';
      
      if (isRisky) {
        if (currentPercentage >= threshold) {
          riskMessage = `⚠️ This would put you below the minimum requirement of ${threshold}%. `;
          const classesNeeded = calculateClassesForTarget(
            currentAttended,
            currentTotal + classesToMiss,
            threshold
          );
          
          if (classesNeeded === Infinity) {
            riskMessage += `Once you miss these classes, it would be impossible to reach ${threshold}% again this semester.`;
          } else {
            riskMessage += `You would then need to attend ${classesNeeded} more consecutive classes to get back above ${threshold}%.`;
          }
        } else {
          riskMessage = `⚠️ This would further reduce your attendance which is already below the minimum requirement of ${threshold}%. `;
          const classesNeeded = calculateClassesForTarget(
            currentAttended,
            currentTotal + classesToMiss,
            threshold
          );
          
          if (classesNeeded === Infinity) {
            riskMessage += `It would become impossible to reach ${threshold}% this semester.`;
          } else {
            riskMessage += `You would then need to attend ${classesNeeded} more consecutive classes to reach ${threshold}%.`;
          }
        }
      }
      
      return `If you miss ${classesToMiss} more classes, your attendance would drop from ${formatPercentage(currentPercentage)}% to ${formatPercentage(newPercentage)}% (a decrease of ${formatPercentage(difference)}%). ${riskMessage}`;
    }
    
    // Attendance history or trend
    if (lowerQuery.includes('history') || 
        lowerQuery.includes('trend') ||
        lowerQuery.includes('pattern')) {
      
      if (attendanceData.attendanceDetails && attendanceData.attendanceDetails.length > 0) {
        const recentAttendance = attendanceData.attendanceDetails.slice(-5);
        let recentDates = recentAttendance.map(record => 
          `${new Date(record.date).toLocaleDateString()}: ${record.status === 'present' ? '✓ Present' : '✗ Absent'}`
        ).join('\n');
        
        // Calculate trend
        const totalRecords = attendanceData.attendanceDetails.length;
        const firstHalf = attendanceData.attendanceDetails.slice(0, Math.floor(totalRecords/2));
        const secondHalf = attendanceData.attendanceDetails.slice(Math.floor(totalRecords/2));
        
        const firstHalfPresent = firstHalf.filter(r => r.status === 'present').length;
        const secondHalfPresent = secondHalf.filter(r => r.status === 'present').length;
        
        const firstHalfPercentage = (firstHalfPresent / firstHalf.length) * 100;
        const secondHalfPercentage = (secondHalfPresent / secondHalf.length) * 100;
        
        let trendMessage = '';
        if (secondHalfPercentage > firstHalfPercentage) {
          trendMessage = `Your attendance is improving over time (${formatPercentage(firstHalfPercentage)}% → ${formatPercentage(secondHalfPercentage)}%).`;
        } else if (secondHalfPercentage < firstHalfPercentage) {
          trendMessage = `Your attendance is declining over time (${formatPercentage(firstHalfPercentage)}% → ${formatPercentage(secondHalfPercentage)}%).`;
        } else {
          trendMessage = `Your attendance has been consistent over time (${formatPercentage(firstHalfPercentage)}%).`;
        }
        
        return `Your recent attendance history:\n\n${recentDates}\n\n${trendMessage}\n\nOverall attendance: ${formatPercentage(attendanceData.percentage)}%.`;
      } else {
        return `Your overall attendance is ${formatPercentage(attendanceData.percentage)}%. Detailed history isn't available at the moment.`;
      }
    }
    
    // Subject-specific attendance
    if (lowerQuery.includes('subject') || 
        lowerQuery.includes('course') || 
        lowerQuery.match(/in (Immunology|Computational Biology|english|history|physics|chemistry)/i)) {
      
      // Extract subject name if present
      let subject = 'this course';
      const subjectMatch = lowerQuery.match(/in ([a-z]+)/i);
      if (subjectMatch) {
        subject = subjectMatch[1];
      }
      
      if (attendanceData.subjectWise && attendanceData.subjectWise[subject.toLowerCase()]) {
        const subjectData = attendanceData.subjectWise[subject.toLowerCase()];
        const percentage = formatPercentage(subjectData.percentage);
        
        // Check if at risk for this subject
        const threshold = 75;
        let riskStatus = '';
        
        if (percentage < threshold) {
          const classesNeeded = calculateClassesForTarget(
            subjectData.attended,
            subjectData.total,
            threshold
          );
          
          if (classesNeeded === Infinity) {
            riskStatus = `⚠️ It's not possible to reach the minimum requirement (${threshold}%) for this subject.`;
          } else {
            riskStatus = `⚠️ You need to attend ${classesNeeded} more classes to reach the minimum requirement (${threshold}%).`;
          }
        } else {
          const canMiss = calculateMissableClasses(subjectData.attended, subjectData.total, threshold);
          riskStatus = `You can miss up to ${canMiss} more classes while maintaining the minimum requirement.`;
        }
        
        return `For ${subject}, your attendance is ${percentage}%. You've attended ${subjectData.attended} out of ${subjectData.total} classes. ${riskStatus}`;
      } else {
        return `I don't have subject-specific attendance data for ${subject}. Your overall attendance is ${formatPercentage(attendanceData.percentage)}%.`;
      }
    }
    
    // Recommendation for improvement - IMPROVED with more specific guidance
    if (lowerQuery.includes('improve') || 
        lowerQuery.includes('get better') ||
        lowerQuery.includes('increase')) {
      
      const currentPercentage = attendanceData.percentage;
      let recommendationThreshold = 75;
      let excellentThreshold = 90;
      
      if (currentPercentage >= excellentThreshold) {
        return `Your attendance is excellent at ${formatPercentage(currentPercentage)}%! Just maintain your current regularity.`;
      } else if (currentPercentage >= recommendationThreshold) {
        // Calculate classes needed to reach 90%
        const classesFor90 = calculateClassesForTarget(
          attendanceData.attendedClasses,
          attendanceData.totalClasses,
          excellentThreshold
        );
        
        if (classesFor90 === Infinity) {
          return `Your attendance is good at ${formatPercentage(currentPercentage)}%, above the minimum requirement. However, it's not mathematically possible to reach ${excellentThreshold}% this semester.
          
Some tips to maintain good attendance:
1. Set reminders for classes
2. Plan your schedule ahead to avoid conflicts
3. Maintain a healthy routine to avoid sick days`;
        }
        
        return `Your attendance is good at ${formatPercentage(currentPercentage)}%, above the minimum requirement. To reach an excellent level (${excellentThreshold}%), try to attend the next ${classesFor90} classes without missing any.
        
Some strategies that can help:
1. Set calendar reminders 15 minutes before each class
2. Find a study buddy to hold each other accountable 
3. Track your progress weekly to stay motivated`;
      } else {
        // Calculate minimum classes needed
        const minClassesNeeded = calculateClassesForTarget(
          attendanceData.attendedClasses,
          attendanceData.totalClasses,
          recommendationThreshold
        );
        
        if (minClassesNeeded === Infinity) {
          return `Your attendance of ${formatPercentage(currentPercentage)}% is below the minimum requirement of ${recommendationThreshold}%. Unfortunately, it's mathematically impossible to reach the minimum threshold this semester.

You should speak with your academic advisor about your options, which may include:
1. Requesting special consideration
2. Taking remedial assignments
3. Discussing course withdrawal options if it's still early enough`;
        }
        
        return `Your attendance of ${formatPercentage(currentPercentage)}% is below the minimum requirement of ${recommendationThreshold}%. You should attend at least ${minClassesNeeded} more classes without missing any to reach the minimum threshold.

Here's an improvement plan:
1. Start attending every class immediately - you need ${minClassesNeeded} consecutive classes
2. Set multiple reminders for each class day
3. Create a clear schedule and eliminate conflicts
4. Consider discussing your situation with an academic advisor`;
      }
    }
    
    // Detailed analytics - ENHANCED
    if (lowerQuery.includes('analytics') || 
        lowerQuery.includes('statistics') || 
        lowerQuery.includes('analysis') ||
        lowerQuery.includes('detailed info')) {
      
      const daysPresent = attendanceData.attendedClasses;
      const daysAbsent = attendanceData.totalClasses - attendanceData.attendedClasses;
      const presentPercentage = attendanceData.percentage;
      const absentPercentage = 100 - presentPercentage;
      
      // Calculate attendance trend if data available
      let trendAnalysis = '';
      if (attendanceData.attendanceDetails && attendanceData.attendanceDetails.length >= 5) {
        const recentFive = attendanceData.attendanceDetails.slice(-5);
        const presentCount = recentFive.filter(record => record.status === 'present').length;
        const recentPercentage = (presentCount / 5) * 100;
        
        if (recentPercentage > presentPercentage) {
          trendAnalysis = `Your recent attendance (${formatPercentage(recentPercentage)}% in the last 5 classes) shows improvement over your overall average.`;
        } else if (recentPercentage < presentPercentage) {
          trendAnalysis = `Your recent attendance (${formatPercentage(recentPercentage)}% in the last 5 classes) has declined compared to your overall average.`;
        } else {
          trendAnalysis = `Your recent attendance (${formatPercentage(recentPercentage)}% in the last 5 classes) is consistent with your overall average.`;
        }
      }
      
      // Calculate minimum required attendance for passing
      const threshold = 75;
      const minimumClassesNeeded = calculateClassesForTarget(
        attendanceData.attendedClasses,
        attendanceData.totalClasses,
        threshold
      );
      
      // Calculate classes needed for excellent attendance
      const excellentThreshold = 90;
      const classesForExcellent = calculateClassesForTarget(
        attendanceData.attendedClasses,
        attendanceData.totalClasses,
        excellentThreshold
      );
      
      let attendanceStatus;
      if (presentPercentage >= 90) {
        attendanceStatus = '🟢 Excellent'; 
      } else if (presentPercentage >= threshold) {
        attendanceStatus = '🟡 Satisfactory';
      } else if (minimumClassesNeeded < Infinity) {
        attendanceStatus = `🟠 Below requirement (need ${minimumClassesNeeded} more classes)`;
      } else {
        attendanceStatus = '🔴 Cannot reach minimum requirement';
      }
      
      // Calculate the number of classes that can be missed
      const missableClasses = calculateMissableClasses(
        attendanceData.attendedClasses,
        attendanceData.totalClasses,
        threshold
      );
      
      let missableMessage = '';
      if (missableClasses < 0) {
        missableMessage = `You can't miss any more classes. You need to attend ${Math.abs(missableClasses)} consecutive classes to reach minimum requirements.`;
      } else {
        missableMessage = `You can miss up to ${missableClasses} more classes while maintaining minimum requirements.`;
      }
      
      // Projection for different scenarios
      const projectionMessage = minimumClassesNeeded < Infinity ? 
        `- If you attend all remaining classes: You'll reach ${formatPercentage((attendanceData.attendedClasses + attendanceData.totalRemainingClasses) / (attendanceData.totalClasses + attendanceData.totalRemainingClasses) * 100)}%
- If you attend half of remaining classes: You'll reach ${formatPercentage((attendanceData.attendedClasses + attendanceData.totalRemainingClasses/2) / (attendanceData.totalClasses + attendanceData.totalRemainingClasses) * 100)}%` :
        `- Even if you attend all remaining classes, you cannot reach the minimum threshold of ${threshold}%`;
      
      return `📊 Attendance Analytics:
      
Days Present: ${daysPresent} (${formatPercentage(presentPercentage)}%)
Days Absent: ${daysAbsent} (${formatPercentage(absentPercentage)}%)
Attendance Status: ${attendanceStatus}
${trendAnalysis ? '\nTrend Analysis: ' + trendAnalysis : ''}

${missableMessage}

Projections:
${projectionMessage}

${minimumClassesNeeded < Infinity ? `To reach minimum attendance (${threshold}%), attend ${minimumClassesNeeded} more consecutive classes.` : `It's mathematically impossible to reach minimum attendance (${threshold}%) this semester.`}
${classesForExcellent < Infinity ? `To reach excellent attendance (${excellentThreshold}%), attend ${classesForExcellent} more consecutive classes.` : `It's not possible to reach excellent attendance (${excellentThreshold}%) this semester.`}`;
    }
    
    // Newest addition: What's my status? - Comprehensive overview
    if (lowerQuery.includes('status') || 
        lowerQuery.includes('summary') || 
        lowerQuery.includes('overview') ||
        (lowerQuery.includes('how') && lowerQuery.includes('doing'))) {
      
      const currentPercentage = attendanceData.percentage;
      const threshold = 75;
      
      let statusMessage = '';
      if (currentPercentage >= 90) {
        statusMessage = `🟢 Excellent: Your attendance (${formatPercentage(currentPercentage)}%) is outstanding!`;
      } else if (currentPercentage >= threshold) {
        statusMessage = `🟡 Good: Your attendance (${formatPercentage(currentPercentage)}%) meets requirements.`;
      } else {
        statusMessage = `🟠 At Risk: Your attendance (${formatPercentage(currentPercentage)}%) is below requirements.`;
      }
      
      // Attendance projection
      const classesNeeded = calculateClassesForTarget(
        attendanceData.attendedClasses,
        attendanceData.totalClasses,
        threshold
      );
      
      const missableClasses = calculateMissableClasses(
        attendanceData.attendedClasses,
        attendanceData.totalClasses,
        threshold
      );
      
      let requirementMessage = '';
      if (currentPercentage >= threshold) {
        requirementMessage = `You can miss up to ${missableClasses} more classes while maintaining minimum requirements.`;
      } else if (classesNeeded === Infinity) {
        requirementMessage = `It's mathematically impossible to reach the minimum requirement (${threshold}%) this semester.`;
      } else {
        requirementMessage = `You need to attend ${classesNeeded} more consecutive classes to reach the minimum requirement (${threshold}%).`;
      }
      
      // Recent pattern, if available
      let recentPattern = '';
      if (attendanceData.attendanceDetails && attendanceData.attendanceDetails.length >= 5) {
        const recentFive = attendanceData.attendanceDetails.slice(-5);
        const presentCount = recentFive.filter(record => record.status === 'present').length;
        const recentPercentage = (presentCount / 5) * 100;
        
        recentPattern = `Your recent attendance rate (last 5 classes) is ${formatPercentage(recentPercentage)}%.`;
      }
      
      return `Attendance Summary:
      
${statusMessage}

${requirementMessage}

${recentPattern}

Quick Stats:
- Total classes: ${attendanceData.totalClasses}
- Classes attended: ${attendanceData.attendedClasses}
- Current percentage: ${formatPercentage(currentPercentage)}%
- Minimum required: ${threshold}%`;
    }
    
    // Default response for other queries
    return "I can answer questions about your attendance such as:\n\n- Current percentage ('What's my attendance?')\n- Classes you can miss ('How many classes can I skip?')\n- Required classes ('How many classes to reach 90%?')\n- Risk assessment ('Am I at risk?')\n- Detailed analytics ('Show me attendance analytics')\n- Subject data ('What's my Math attendance?')\n- Improvement plan ('How can I improve my attendance?')\n- Overall status ('What's my attendance status?')";
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Icon */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full p-3 shadow-lg transition-all duration-200 flex items-center justify-center"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="bg-white rounded-lg shadow-xl w-80 sm:w-96 flex flex-col" style={{ height: '400px' }}>
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-3 border-b bg-indigo-600 text-white rounded-t-lg">
            <h3 className="font-medium">Attendance Assistant</h3>
            <button onClick={() => setIsOpen(false)} className="text-white hover:text-gray-200">
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Messages */}
          <div className="flex-1 overflow-auto p-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`mb-2 ${
                  message.sender === 'user'
                    ? 'text-right'
                    : 'text-left'
                }`}
              >
                <div
                  className={`inline-block px-3 py-2 rounded-lg ${
                    message.sender === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input */}
          <div className="border-t p-3 flex">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about your attendance..."
              className="flex-1 border border-gray-300 rounded-l-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              onClick={handleSend}
              className="bg-indigo-600 text-white px-3 py-2 rounded-r-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-700"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}