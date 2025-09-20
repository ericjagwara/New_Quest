import type { AttendanceRecord, UserRecord, DashboardStats } from "./types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://hygienequestemdpoints.onrender.com"

// Helper function to get auth token
const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  const authUser = localStorage.getItem('authUser');
  if (!authUser) return null;
  
  try {
    const userData = JSON.parse(authUser);
    return userData.access_token || null;
  } catch {
    return null;
  }
};

export interface LessonPlan {
  id: string;
  phone: string;
  score: number;
  subject: string;
  feedback: string;
  spaces_file_path: string;
  original_filename: string;
  public_url: string;
  created_at: string;
  teacher_name?: string;
  school?: string;
  district?: string;
}

// Updated function to use public lesson plans endpoint
export const fetchLessonPlans = async (): Promise<LessonPlan[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/public/lessonplans`, {
      method: 'GET',
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`API response not ok: ${response.status} ${response.statusText}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Successfully fetched lesson plans from API");
    return data;
  } catch (error) {
    console.error("Error fetching lesson plans:", error);
    // Return empty array instead of throwing to prevent UI breakage
    return [];
  }
};

// Helper function to get export token for managers
const getExportToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('export_token');
};

// Helper function to get current user info
const getCurrentUser = (): any => {
  if (typeof window === 'undefined') return null;
  const authUser = localStorage.getItem('authUser');
  if (!authUser) return null;
  
  try {
    return JSON.parse(authUser);
  } catch {
    return null;
  }
};

// Function to store export token with timestamp
export const setExportToken = (token: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('export_token', token);
    localStorage.setItem('export_token_timestamp', Date.now().toString());
  }
};

// Function to clear export token
export const clearExportToken = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('export_token');
    localStorage.removeItem('export_token_timestamp');
  }
};

// Function to check if user has export access
export const hasExportAccess = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const exportToken = localStorage.getItem('export_token');
  if (!exportToken) return false;
  
  const tokenTimestamp = localStorage.getItem('export_token_timestamp');
  if (tokenTimestamp) {
    const tokenTime = parseInt(tokenTimestamp, 10);
    const currentTime = Date.now();
    // Check if token is older than 30 minutes
    if (currentTime - tokenTime > 30 * 60 * 1000) {
      clearExportToken();
      return false;
    }
  }
  
  return true;
};

// Fallback data function
const getFallbackAttendanceData = (): AttendanceRecord[] => {
  return [
    {
      id: "1",
      phone: "0772207616",
      subject: "Mathematics",
      students_present: 25,
      students_absent: 5,
      absence_reason: "Sickness and weather conditions",
      district: "Kisoro",
    },
    {
      id: "2", 
      phone: "0774405405",
      subject: "English",
      students_present: 30,
      students_absent: 3,
      absence_reason: "School fees issues",
      district: "Isingiro",
    },
    {
      id: "3",
      phone: "0700677231", 
      subject: "Science",
      students_present: 22,
      students_absent: 8,
      absence_reason: "Rain and flu outbreak",
      district: "Kaliro",
    },
    {
      id: "4",
      phone: "0708210793",
      subject: "Social Studies", 
      students_present: 28,
      students_absent: 2,
      absence_reason: "Family obligations",
      district: "Ibanda",
    },
  ];
};

// For regular (masked) data - uses public endpoints and returns RAW DATA (no enhancement)
export async function fetchAttendanceData(): Promise<AttendanceRecord[]> {
  const currentUser = getCurrentUser();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${API_BASE_URL}/public/attendances`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`API response not ok: ${response.status} ${response.statusText}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    let data = await response.json();
    console.log("Successfully fetched attendance data from API");
    
    // If user is a school admin, filter data to only show their school
    if (currentUser && currentUser.role === "schooladmin" && currentUser.school) {
      const usersData = await fetchUsersData();
      data = data.filter((record: AttendanceRecord) => {
        const recordUser = usersData.find((u: UserRecord) => u.phone === record.phone);
        return recordUser?.school === currentUser.school;
      });
    }
    
    // Return RAW data - masking will be applied in the component after enhancement
    return data;
  } catch (error) {
    console.warn("API unavailable, using fallback attendance data:", error);
    return getFallbackAttendanceData();
  }
}

// For unmasked data (after OTP verification) - uses the same public endpoints but returns unmasked data
export async function fetchUnmaskedAttendanceData(): Promise<AttendanceRecord[]> {
  const exportToken = getExportToken();
  const currentUser = getCurrentUser();
  
  console.log("Fetching unmasked attendance data...");
  console.log("Export token exists:", !!exportToken);
  console.log("Has export access:", hasExportAccess());
  
  if (!exportToken || !hasExportAccess()) {
    throw new Error("No valid export access");
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // For now, use the same public endpoint since it returns real data
    console.log("Making request to:", `${API_BASE_URL}/public/attendances`);
    
    const response = await fetch(`${API_BASE_URL}/public/attendances`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        // Note: We're not sending the token since public endpoint doesn't need it
        // But we've validated the token exists locally
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`API response not ok: ${response.status} ${response.statusText}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    let data = await response.json();
    console.log("Successfully fetched UNMASKED attendance data from API:", data.length, "records");
    console.log("Sample unmasked attendance record:", data[0]);
    
    // The public endpoint already returns enhanced data with real names
    // So we just need to ensure proper structure
    const processedData = data.map((record: any) => ({
      id: record.id,
      phone: record.phone,
      subject: record.subject,
      students_present: record.students_present,
      students_absent: record.students_absent,
      absence_reason: record.absence_reason,
      district: record.district,
      teacher_name: record.teacher_name,
      school: record.school,
    }));
    
    // If user is a school admin, filter data to only show their school
    if (currentUser && currentUser.role === "schooladmin" && currentUser.school) {
      const filteredData = processedData.filter((record: AttendanceRecord) => 
        record.school === currentUser.school
      );
      console.log("Filtered data for school admin:", filteredData.length, "records");
      return filteredData;
    }
    
    return processedData;
  } catch (error) {
    console.error("Failed to fetch unmasked attendance data:", error);
    throw error;
  }
}

// For unmasked user data
export async function fetchUnmaskedUsersData(): Promise<UserRecord[]> {
  const exportToken = getExportToken();
  
  console.log("Fetching unmasked users data...");
  console.log("Export token exists:", !!exportToken);
  
  if (!exportToken || !hasExportAccess()) {
    throw new Error("No valid export access");
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // Use the same public endpoint since it returns real data
    console.log("Making request to:", `${API_BASE_URL}/public/registrations`);

    const response = await fetch(`${API_BASE_URL}/public/registrations`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`API response not ok: ${response.status} ${response.statusText}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Successfully fetched UNMASKED users data from API:", data.length, "records");
    console.log("Sample unmasked user record:", data[0]);
    return data;
  } catch (error) {
    console.error("Failed to fetch unmasked users data:", error);
    throw error;
  }
}

// Updated to use public registrations endpoint and returns RAW DATA (no masking)
export async function fetchUsersData(): Promise<UserRecord[]> {
  const currentUser = getCurrentUser();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${API_BASE_URL}/public/registrations`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`API response not ok: ${response.status} ${response.statusText}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    let data = await response.json();
    console.log("Successfully fetched users data from API");
    
    // If user is a school admin, filter data to only show their school
    if (currentUser && currentUser.role === "schooladmin" && currentUser.school) {
      data = data.filter((user: UserRecord) => user.school === currentUser.school);
    }
    
    // Return RAW data - masking will be applied in the component if needed
    return data;
  } catch (error) {
    console.warn("API unavailable, using fallback users data:", error);
    // Always return fallback data instead of throwing
    return [
      {
        id: "1",
        phone: "0772207616",
        name: "Katende Brian",
        school: "St. Mary's Primary",
        district: "Kisoro",
        role: "teacher",
      },
      {
        id: "2",
        phone: "0774405405",
        name: "John Doe",
        school: "Kampala Primary",
        district: "Isingiro",
        role: "teacher",
      },
      {
        id: "3",
        phone: "0700677231",
        name: "Charity Atuheire",
        school: "Mary Secondary School",
        district: "Kaliro",
        role: "teacher",
      },
      {
        id: "4",
        phone: "0708210793",
        name: "Sarah Nakato",
        school: "Luweero Primary",
        district: "Ibanda",
        role: "teacher",
      },
    ];
  }
}

export function calculateStats(attendanceData: AttendanceRecord[], usersData: UserRecord[]): DashboardStats {
  const totalPresent = attendanceData.reduce((sum, item) => sum + (item.students_present || 0), 0);
  const totalAbsent = attendanceData.reduce((sum, item) => sum + (item.students_absent || 0), 0);
  const totalAttendance = totalPresent + totalAbsent;
  const attendanceRate = totalAttendance > 0 ? Number(((totalPresent / totalAttendance) * 100).toFixed(1)) : 0;

  const totalSchools = [...new Set(usersData.map((user) => user.school))].length;
  const totalDistricts = [...new Set(usersData.map((user) => user.district))].length;
  const totalTeachers = [...new Set(attendanceData.map((item) => item.phone))].length;

  return {
    totalPresent,
    totalAbsent,
    attendanceRate,
    totalSchools,
    totalDistricts,
    totalTeachers,
  };
}

export function processAbsenceReasons(attendanceData: AttendanceRecord[]) {
  const reasonCounts: Record<string, number> = {};

  attendanceData.forEach((record) => {
    const reason = record.absence_reason.toLowerCase();
    if (reason.includes("sick") || reason.includes("flu") || reason.includes("malaria")) {
      reasonCounts["Health Issues"] = (reasonCounts["Health Issues"] || 0) + record.students_absent;
    } else if (reason.includes("weather") || reason.includes("rain")) {
      reasonCounts["Bad Weather"] = (reasonCounts["Bad Weather"] || 0) + record.students_absent;
    } else if (reason.includes("fees") || reason.includes("school fees")) {
      reasonCounts["School Fees"] = (reasonCounts["School Fees"] || 0) + record.students_absent;
    } else {
      reasonCounts["Other Reasons"] = (reasonCounts["Other Reasons"] || 0) + record.students_absent;
    }
  });

  return Object.entries(reasonCounts).map(([reason, count]) => ({
    name: reason,
    value: count,
  }));
}

export function processAttendanceByDistrict(attendanceData: AttendanceRecord[], usersData: UserRecord[]) {
  const districtData: Record<string, { present: number; absent: number }> = {};

  attendanceData.forEach((record) => {
    const user = usersData.find((u) => u.phone === record.phone);
    const district = user?.district || "Unknown";

    if (!districtData[district]) {
      districtData[district] = { present: 0, absent: 0 };
    }

    districtData[district].present += record.students_present;
    districtData[district].absent += record.students_absent;
  });

  return Object.entries(districtData).map(([district, data]) => ({
    district,
    present: data.present,
    absent: data.absent,
  }));
}

// Function to fetch school-specific data for school admins
export async function fetchSchoolData(schoolName: string): Promise<{
  attendance: AttendanceRecord[];
  users: UserRecord[];
}> {
  try {
    const [attendanceData, usersData] = await Promise.all([
      fetchAttendanceData(),
      fetchUsersData()
    ]);

    // Filter data to only include the specified school
    const schoolUsers = usersData.filter(user => user.school === schoolName);
    const schoolUserPhones = schoolUsers.map(user => user.phone);
    const schoolAttendance = attendanceData.filter(record => 
      schoolUserPhones.includes(record.phone)
    );

    return {
      attendance: schoolAttendance,
      users: schoolUsers
    };
  } catch (error) {
    console.error("Error fetching school data:", error);
    throw new Error("Failed to fetch school data");
  }
}