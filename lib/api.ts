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

// Fetch attendance data with authentication and role-based filtering
export async function fetchAttendanceData(): Promise<AttendanceRecord[]> {
  const token = getAuthToken();
  const exportToken = getExportToken();
  const currentUser = getCurrentUser();
  
  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    
    // Use export token for managers if available, otherwise use regular token
    if (exportToken) {
      headers["Authorization"] = `Bearer ${exportToken}`;
    } else if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${API_BASE_URL}/attendances`, {
      method: "GET",
      headers,
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
      // We need to get user data to match schools
      const usersData = await fetchUsersData();
      data = data.filter((record: AttendanceRecord) => {
        const recordUser = usersData.find((u: UserRecord) => u.phone === record.phone);
        return recordUser?.school === currentUser.school;
      });
    }
    
    return data;
  } catch (error) {
    console.warn("API unavailable, using fallback attendance data:", error);
    // Always return fallback data instead of throwing
    return [
      {
        id: 1,
        phone: "0772207616",
        students_present: 30,
        students_absent: 2,
        absence_reason: "2 students sick",
        subject: "Personal Hygiene",
        district: "Kisoro",
      },
      {
        id: 2,
        phone: "0772207616",
        students_present: 18,
        students_absent: 21,
        absence_reason: "bad weather, it was raining too much",
        subject: "Hand Washing Techniques",
        district: "Kisoro",
      },
      {
        id: 3,
        phone: "0774405405",
        students_present: 25,
        students_absent: 8,
        absence_reason: "school fees",
        subject: "Dental Hygiene",
        district: "Isingiro",
      },
      {
        id: 4,
        phone: "0700677231",
        students_present: 40,
        students_absent: 12,
        absence_reason: "malaria outbreak",
        subject: "Food Safety",
        district: "Kaliro",
      },
      {
        id: 5,
        phone: "0708210793",
        students_present: 35,
        students_absent: 5,
        absence_reason: "flu symptoms",
        subject: "Environmental Hygiene",
        district: "Ibanda",
      },
    ];
  }
}

// Fetch user/registration data with authentication and role-based filtering
export async function fetchUsersData(): Promise<UserRecord[]> {
  const token = getAuthToken();
  const exportToken = getExportToken();
  const currentUser = getCurrentUser();
  
  try {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    
    // Use export token for managers if available, otherwise use regular token
    if (exportToken) {
      headers["Authorization"] = `Bearer ${exportToken}`;
    } else if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${API_BASE_URL}/registrations`, {
      method: "GET",
      headers,
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
    
    return data;
  } catch (error) {
    console.warn("API unavailable, using fallback users data:", error);
    // Always return fallback data instead of throwing
    return [
      {
        id: 1,
        phone: "0772207616",
        name: "Katende Brian",
        school: "St. Mary's Primary",
        district: "Kisoro",
        language: "English",
      },
      {
        id: 2,
        phone: "0774405405",
        name: "John Doe",
        school: "Kampala Primary",
        district: "Isingiro",
        language: "English",
      },
      {
        id: 3,
        phone: "0700677231",
        name: "Charity Atuheire",
        school: "Mary Secondary School",
        district: "Kaliro",
        language: "English",
      },
      {
        id: 4,
        phone: "0708210793",
        name: "Sarah Nakato",
        school: "Luweero Primary",
        district: "Ibanda",
        language: "English",
      },
    ];
  }
}

// Function to clear export token (call this when manager logs out or session expires)
export const clearExportToken = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('export_token');
  }
};

// Function to check if user has export access (for managers)
export const hasExportAccess = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const exportToken = localStorage.getItem('export_token');
  if (!exportToken) return false;
  
  // Check if token is expired (simple check - in real app, decode JWT)
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

// Function to store export token with timestamp
export const setExportToken = (token: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('export_token', token);
    localStorage.setItem('export_token_timestamp', Date.now().toString());
  }
};

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