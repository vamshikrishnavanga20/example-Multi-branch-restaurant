"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  UserCheck, Clock, Calendar as CalendarIcon, Search, LogIn, LogOut, 
  Users, CheckCircle2, AlertCircle, Loader2, Sparkles, Filter, 
  Plus, Trash2, Edit3, ShieldAlert, ChevronLeft, ChevronRight, 
  Building2, Briefcase, Phone, Check, X, CalendarCheck, CalendarX,
  Layers, Info, Wand2, CheckSquare, Square, CalendarDays, ArrowRight,
  Sun, Moon
} from "lucide-react";
import { Branch, StaffAttendanceEntry, StaffMember, CalendarDayConfig } from "@/types";
import { Glass, PageHead, inputCls } from "@/components/ui/Primitives";
import { useToast, useConfirm } from "@/components/ui/LuxuryNotifications";
import { useTheme } from "@/lib/theme-context";

interface AttendanceViewProps {
  branches?: Branch[];
  selectedBranch?: string;
  onSelectBranch?: (id: string) => void;
  isSuperAdmin?: boolean;
  sessionRole?: string;
  sessionBranchId?: string;
}

type TabType = "terminal" | "roster" | "calendar" | "working_days";
type DateFilterType = "today" | "yesterday" | "7d" | "30d" | "custom";

const ROLES = [
  "Head Chef",
  "Sous Chef",
  "Line Cook",
  "Kitchen Assistant",
  "Floor Manager",
  "Captain",
  "Senior Waiter",
  "Waiter",
  "Cashier",
  "Bartender",
  "Steward",
  "Host / Receptionist",
  "Cleaner",
  "Security",
];

const DEPARTMENTS = [
  "Kitchen",
  "Service",
  "Front Office",
  "Operations",
  "Bar",
  "Housekeeping",
];

export default function AttendanceView({
  branches = [],
  selectedBranch = "ALL",
  onSelectBranch,
  isSuperAdmin = true,
  sessionRole,
  sessionBranchId,
}: AttendanceViewProps) {
  const { mode, themeConfig } = useTheme();
  const isLight = mode === "light";
  const toast = useToast();
  const confirm = useConfirm();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<TabType>("terminal");

  // Active branch context
  // If user is branch manager, restrict to their assigned branch
  const effectiveBranchId = useMemo(() => {
    if (!isSuperAdmin && sessionBranchId && sessionBranchId !== "ALL") {
      return sessionBranchId;
    }
    return selectedBranch && selectedBranch !== "ALL" ? selectedBranch : "branch-hyderabad-hq";
  }, [isSuperAdmin, sessionBranchId, selectedBranch]);

  const activeBranch = useMemo(() => {
    return branches.find(b => b.id === effectiveBranchId) || {
      id: effectiveBranchId,
      name: effectiveBranchId === "branch-bodhgaya-highway-express-9cba" || effectiveBranchId === "branch-bodhgaya-02"
        ? "Bodhgaya Highway Express"
        : "Hyderabad Highway HQ",
      code: effectiveBranchId === "branch-bodhgaya-highway-express-9cba" || effectiveBranchId === "branch-bodhgaya-02"
        ? "BDG-02"
        : "HYD-01",
    };
  }, [branches, effectiveBranchId]);

  // Date Filter State for Duty Board
  const [dateFilter, setDateFilter] = useState<DateFilterType>("today");
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Staff Roster State
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Attendance Logs State
  const [logs, setLogs] = useState<StaffAttendanceEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  // Staff Modal State (Add / Edit)
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [staffForm, setStaffForm] = useState({
    name: "",
    role: "Waiter",
    department: "Service",
    phone: "",
  });

  // Calendar View State
  const [calendarStaffId, setCalendarStaffId] = useState<string>("");
  const [calendarStaffSearch, setCalendarStaffSearch] = useState("");
  const [isStaffSearchOpen, setIsStaffSearchOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedSpecificDate, setSelectedSpecificDate] = useState<string>("");
  const [calendarLogs, setCalendarLogs] = useState<StaffAttendanceEntry[]>([]);
  const [calendarDaysConfig, setCalendarDaysConfig] = useState<CalendarDayConfig[]>([]);

  // Super Admin Working Days Convenience State
  const [selectedCalendarDates, setSelectedCalendarDates] = useState<string[]>([]);
  const [rangeHolidayStart, setRangeHolidayStart] = useState("");
  const [rangeHolidayEnd, setRangeHolidayEnd] = useState("");
  const [rangeHolidayReason, setRangeHolidayReason] = useState("");
  const [batchUpdating, setBatchUpdating] = useState(false);

  // Holiday modal & confirmation state
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [holidayReasonInput, setHolidayReasonInput] = useState("Weekly Off");
  const staffSearchRef = useRef<HTMLDivElement>(null);

  /* -------------------------------------------------------------------------- */
  /* DATA FETCHING                                                              */
  /* -------------------------------------------------------------------------- */

  // 1. Fetch Staff Roster for active branch
  const fetchStaffRoster = useCallback(async () => {
    setStaffLoading(true);
    try {
      const res = await fetch(`/api/staff?branch_id=${effectiveBranchId}`);
      if (res.ok) {
        const data = await res.json();
        setStaffList(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to load staff roster:", err);
    } finally {
      setStaffLoading(false);
    }
  }, [effectiveBranchId]);

  // 2. Fetch Attendance Logs based on Date Range
  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      let queryUrl = `/api/attendance?branch_id=${effectiveBranchId}`;
      const todayStr = new Date().toISOString().split("T")[0];

      if (dateFilter === "today") {
        queryUrl += `&date=${todayStr}`;
      } else if (dateFilter === "yesterday") {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        const yStr = y.toISOString().split("T")[0];
        queryUrl += `&date=${yStr}`;
      } else if (dateFilter === "7d") {
        const start = new Date();
        start.setDate(start.getDate() - 6);
        queryUrl += `&start_date=${start.toISOString().split("T")[0]}&end_date=${todayStr}`;
      } else if (dateFilter === "30d") {
        const start = new Date();
        start.setDate(start.getDate() - 29);
        queryUrl += `&start_date=${start.toISOString().split("T")[0]}&end_date=${todayStr}`;
      } else if (dateFilter === "custom") {
        queryUrl += `&start_date=${customStartDate}&end_date=${customEndDate}`;
      }

      const res = await fetch(queryUrl);
      if (res.ok) {
        const data = await res.json();
        setLogs(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLogsLoading(false);
    }
  }, [effectiveBranchId, dateFilter, customStartDate, customEndDate]);

  // 3. Fetch Calendar Configuration (Holidays / Working Days)
  const fetchCalendarConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/calendar?month=${calendarMonth}`);
      if (res.ok) {
        const data = await res.json();
        setCalendarDaysConfig(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch calendar config:", err);
    }
  }, [calendarMonth]);

  // 4. Fetch Staff Calendar Logs
  const fetchStaffCalendarLogs = useCallback(async () => {
    if (!calendarStaffId) return;
    try {
      const [year, month] = calendarMonth.split("-").map(Number);
      const startStr = `${calendarMonth}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endStr = `${calendarMonth}-${String(lastDay).padStart(2, "0")}`;

      const res = await fetch(`/api/attendance?staff_id=${calendarStaffId}&start_date=${startStr}&end_date=${endStr}&branch_id=${effectiveBranchId}`);
      if (res.ok) {
        const data = await res.json();
        setCalendarLogs(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch calendar logs for staff:", err);
    }
  }, [calendarStaffId, calendarMonth, effectiveBranchId]);

  useEffect(() => {
    fetchStaffRoster();
  }, [fetchStaffRoster]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    fetchCalendarConfig();
  }, [fetchCalendarConfig]);

  useEffect(() => {
    if (calendarStaffId) {
      fetchStaffCalendarLogs();
    }
  }, [calendarStaffId, fetchStaffCalendarLogs]);

  // Pre-select first staff member for calendar view
  useEffect(() => {
    if (staffList.length > 0 && !calendarStaffId) {
      setCalendarStaffId(staffList[0].id);
    }
  }, [staffList, calendarStaffId]);

  // Outside click listener to dismiss staff search dropdown smoothly
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (staffSearchRef.current && !staffSearchRef.current.contains(e.target as Node)) {
        setIsStaffSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* -------------------------------------------------------------------------- */
  /* STATUS CALCULATIONS                                                        */
  /* -------------------------------------------------------------------------- */

  const getStaffStatus = useCallback((staffId: string) => {
    const staffLogs = logs
      .filter((l) => l.staff_id === staffId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (staffLogs.length === 0) return { status: "absent" as const, lastLog: null };
    const latest = staffLogs[0];
    return {
      status: latest.action === "clock_in" ? ("on_duty" as const) : ("off_duty" as const),
      lastLog: latest,
    };
  }, [logs]);

  const onDutyCount = useMemo(() => {
    return staffList.filter((s) => getStaffStatus(s.id).status === "on_duty").length;
  }, [staffList, getStaffStatus]);

  const filteredStaff = useMemo(() => {
    return staffList.filter(
      (s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.department.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [staffList, searchQuery]);

  // Filtered staff for calendar view search bar
  const filteredCalendarStaff = useMemo(() => {
    if (!calendarStaffSearch.trim()) return staffList;
    const q = calendarStaffSearch.toLowerCase().trim();
    return staffList.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q)
    );
  }, [staffList, calendarStaffSearch]);

  const selectedCalendarStaff = useMemo(() => {
    return staffList.find((s) => s.id === calendarStaffId) || null;
  }, [staffList, calendarStaffId]);

  /* -------------------------------------------------------------------------- */
  /* ACTIONS WITH UNIVERSAL CONFIRM / CANCEL                                     */
  /* -------------------------------------------------------------------------- */

  // 1. Clock In / Out
  const handleClockAction = async (staff: StaffMember, action: "clock_in" | "clock_out") => {
    const isClockIn = action === "clock_in";
    const confirmed = await confirm({
      title: isClockIn ? `Confirm Clock In: ${staff.name}` : `Confirm Clock Out: ${staff.name}`,
      description: isClockIn
        ? `Are you sure you want to mark ${staff.name} (${staff.role}) as On-Duty for ${activeBranch.name}?`
        : `Are you sure you want to clock out ${staff.name} (${staff.role}) and complete their shift?`,
      confirmText: isClockIn ? "Clock In Now" : "Clock Out Now",
      cancelText: "Cancel",
      variant: isClockIn ? "default" : "warning",
    });

    if (!confirmed) return;

    setActionLoading(staff.id);
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: staff.id,
          staff_name: staff.name,
          action,
          notes: notes.trim() || undefined,
          branch_id: effectiveBranchId,
          branch_name: activeBranch.name,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Unable to record attendance.");
      }

      const newEntry = await res.json();
      setLogs((prev) => [newEntry, ...prev]);
      setNotes("");
      toast.success(
        isClockIn ? "Clocked In Successfully" : "Clocked Out Successfully",
        `${staff.name} is now ${isClockIn ? "On Duty" : "Off Duty"} at ${activeBranch.name}.`
      );
      if (staff.id === calendarStaffId) {
        fetchStaffCalendarLogs();
      }
    } catch (err: any) {
      toast.error("Attendance Failed", err.message);
    } finally {
      setActionLoading(null);
    }
  };

  // 2. Add New Staff Member
  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.name.trim()) {
      toast.error("Validation Error", "Please provide a staff name.");
      return;
    }

    const confirmed = await confirm({
      title: "Add New Staff Member",
      description: `Confirm adding ${staffForm.name} as "${staffForm.role}" to ${activeBranch.name}?`,
      confirmText: "Add Staff Member",
      cancelText: "Cancel",
    });

    if (!confirmed) return;

    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: staffForm.name.trim(),
          role: staffForm.role,
          department: staffForm.department,
          phone: staffForm.phone.trim(),
          branch_id: effectiveBranchId,
          branch_name: activeBranch.name,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create staff member.");
      }

      const newMember = await res.json();
      setStaffList((prev) => [...prev, newMember]);
      setIsAddStaffOpen(false);
      setStaffForm({ name: "", role: "Waiter", department: "Service", phone: "" });
      toast.success("Staff Member Added", `${newMember.name} has been added to ${activeBranch.name} roster.`);
    } catch (err: any) {
      toast.error("Failed to Add Staff", err.message);
    }
  };

  // 3. Update Staff Role / Details
  const handleUpdateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;

    const confirmed = await confirm({
      title: "Save Staff Changes",
      description: `Confirm role and detail changes for ${editingStaff.name} at ${activeBranch.name}?`,
      confirmText: "Save Changes",
      cancelText: "Cancel",
    });

    if (!confirmed) return;

    try {
      const res = await fetch("/api/staff", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingStaff.id,
          branch_id: effectiveBranchId,
          name: editingStaff.name,
          role: editingStaff.role,
          department: editingStaff.department,
          phone: editingStaff.phone,
          status: editingStaff.status,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update staff member.");
      }

      const updated = await res.json();
      setStaffList((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setEditingStaff(null);
      toast.success("Roster Updated", `${updated.name}'s profile and role have been updated.`);
    } catch (err: any) {
      toast.error("Update Failed", err.message);
    }
  };

  // 4. Delete Staff Member
  const handleDeleteStaff = async (staff: StaffMember) => {
    const confirmed = await confirm({
      title: "Remove Staff Member",
      description: `Are you sure you want to permanently remove "${staff.name}" from ${activeBranch.name}? This will remove them from the active duty roster.`,
      confirmText: "Remove Staff Member",
      cancelText: "Cancel",
      variant: "danger",
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/staff?id=${staff.id}&branch_id=${effectiveBranchId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete staff member.");
      }

      setStaffList((prev) => prev.filter((s) => s.id !== staff.id));
      if (calendarStaffId === staff.id) {
        setCalendarStaffId(staffList.find((s) => s.id !== staff.id)?.id || "");
      }
      toast.success("Staff Member Removed", `${staff.name} has been removed from the roster.`);
    } catch (err: any) {
      toast.error("Deletion Failed", err.message);
    }
  };

  // 5. Jump to Specific Date in Calendar
  const handleJumpToDate = (dateStr: string) => {
    if (!dateStr) return;
    const [year, month] = dateStr.split("-");
    setCalendarMonth(`${year}-${month}`);
    setSelectedSpecificDate(dateStr);
    toast.info("Date Selected", `Viewing attendance calendar for ${dateStr}.`);
  };

  // 6. Super Admin Batch Working Day / Holiday Setters
  const handleBatchCalendarUpdate = async (dates: string[], isWorkingDay: boolean, reason?: string) => {
    if (!isSuperAdmin) {
      toast.error("Access Denied", "Only Super Admin can configure holidays and working days.");
      return;
    }
    if (dates.length === 0) {
      toast.warning("No Dates Selected", "Please select at least one date.");
      return;
    }

    const actionName = isWorkingDay ? "Official Working Days" : "Holidays / Weekly Offs";
    const confirmed = await confirm({
      title: `Batch Set ${dates.length} Days as ${isWorkingDay ? 'Working' : 'Holiday'}?`,
      description: `Mark ${dates.length} dates as ${actionName}${reason ? ` ("${reason}")` : ''}?`,
      confirmText: `Confirm ${dates.length} Days`,
      cancelText: "Cancel",
      variant: isWorkingDay ? "default" : "warning",
    });

    if (!confirmed) return;

    setBatchUpdating(true);
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dates,
          is_working_day: isWorkingDay,
          reason: reason || (isWorkingDay ? "Regular Operating Day" : "Hotel Holiday / Off"),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Batch update failed.");
      }

      const updated = await res.json();
      const updatedArray = Array.isArray(updated) ? updated : [updated];
      setCalendarDaysConfig((prev) => {
        const updatedDates = new Set(dates);
        const remaining = prev.filter((d) => !updatedDates.has(d.date));
        return [...remaining, ...updatedArray];
      });
      setSelectedCalendarDates([]);
      toast.success("Calendar Updated", `Successfully marked ${dates.length} days as ${actionName}.`);
    } catch (err: any) {
      toast.error("Update Failed", err.message);
    } finally {
      setBatchUpdating(false);
    }
  };

  // Restore Selected Dates to Regular Operating Working Days
  const handleRestoreWorkingDays = async () => {
    if (selectedCalendarDates.length === 0) return;
    const count = selectedCalendarDates.length;
    const confirmed = await confirm({
      title: `Restore as Official Working Day`,
      description: `Restore ${count === 1 ? selectedCalendarDates[0] : `${count} selected dates`} back to regular hotel operating days?`,
      confirmText: `Confirm Working Day${count > 1 ? "s" : ""}`,
      cancelText: "Cancel",
      variant: "default",
    });

    if (!confirmed) return;

    await handleBatchCalendarUpdate(
      selectedCalendarDates,
      true,
      "Regular Operating Day"
    );
  };

  // Range Setter: Apply holiday / off to custom date range
  const handleApplyRangeHoliday = (isWorking: boolean) => {
    if (!rangeHolidayStart || !rangeHolidayEnd) {
      toast.warning("Incomplete Range", "Please specify both Start Date and End Date.");
      return;
    }
    const start = new Date(rangeHolidayStart);
    const end = new Date(rangeHolidayEnd);
    if (start > end) {
      toast.error("Invalid Range", "Start Date cannot be after End Date.");
      return;
    }
    const dates: string[] = [];
    const curr = new Date(start);
    while (curr <= end) {
      dates.push(curr.toISOString().split("T")[0]);
      curr.setDate(curr.getDate() + 1);
    }
    handleBatchCalendarUpdate(
      dates,
      isWorking,
      rangeHolidayReason.trim() || (isWorking ? "Regular Operating Day" : "Hotel Holiday / Closure")
    );
  };

  /* -------------------------------------------------------------------------- */
  /* MONTH NAVIGATION HELPERS                                                   */
  /* -------------------------------------------------------------------------- */

  const handlePrevMonth = () => {
    const [y, m] = calendarMonth.split("-").map(Number);
    const date = new Date(y, m - 2, 1);
    setCalendarMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  };

  const handleNextMonth = () => {
    const [y, m] = calendarMonth.split("-").map(Number);
    const date = new Date(y, m, 1);
    setCalendarMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  };

  /* -------------------------------------------------------------------------- */
  /* CALENDAR COMPUTATIONS                                                      */
  /* -------------------------------------------------------------------------- */

  const monthGridData = useMemo(() => {
    const [year, month] = calendarMonth.split("-").map(Number);
    const firstDayIndex = new Date(year, month - 1, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(year, month, 0).getDate();

    // Map logs by date for selected staff member
    const logsByDate: Record<string, StaffAttendanceEntry[]> = {};
    for (const log of calendarLogs) {
      const dateKey = log.timestamp.split("T")[0];
      if (!logsByDate[dateKey]) logsByDate[dateKey] = [];
      logsByDate[dateKey].push(log);
    }

    // Map holiday / working day config
    const dayConfigMap: Record<string, CalendarDayConfig> = {};
    for (const cfg of calendarDaysConfig) {
      dayConfigMap[cfg.date] = cfg;
    }

    let workedDaysCount = 0;
    let officialWorkingDaysCount = 0;
    let totalShiftHours = 0;

    const days = [];
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dateStr = `${calendarMonth}-${String(day).padStart(2, "0")}`;
      const dayOfWeek = new Date(year, month - 1, day).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const override = dayConfigMap[dateStr];
      const isWorkingDay = override !== undefined ? override.is_working_day : !isWeekend;
      if (isWorkingDay) {
        officialWorkingDaysCount++;
      }

      const dayLogs = logsByDate[dateStr] || [];
      const hasClockIn = dayLogs.some((l) => l.action === "clock_in");
      const isWorked = hasClockIn || dayLogs.length > 0;

      if (isWorked) {
        workedDaysCount++;
        const ins = dayLogs.filter((l) => l.action === "clock_in").sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const outs = dayLogs.filter((l) => l.action === "clock_out").sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        if (ins.length > 0 && outs.length > 0) {
          const diffMs = new Date(outs[0].timestamp).getTime() - new Date(ins[0].timestamp).getTime();
          const hours = Math.max(0.5, Math.round((diffMs / 3600000) * 10) / 10);
          totalShiftHours += hours;
        } else {
          totalShiftHours += 8;
        }
      }

      days.push({
        dayNumber: day,
        dateStr,
        isWorkingDay,
        override,
        isWorked,
        dayLogs,
      });
    }

    const attendanceRate = officialWorkingDaysCount > 0 
      ? Math.min(100, Math.round((workedDaysCount / officialWorkingDaysCount) * 100))
      : 100;

    return {
      firstDayIndex,
      days,
      workedDaysCount,
      officialWorkingDaysCount,
      totalShiftHours: Math.round(totalShiftHours * 10) / 10,
      attendanceRate,
    };
  }, [calendarMonth, calendarLogs, calendarDaysConfig]);

  // Selected date breakdown for calendar view
  const selectedDateBreakdown = useMemo(() => {
    if (!selectedSpecificDate) return null;
    return monthGridData.days.find(d => d.dateStr === selectedSpecificDate) || null;
  }, [selectedSpecificDate, monthGridData]);

  // Computed Status of Currently Selected Dates in Calendar View
  const selectedStatuses = useMemo(() => {
    if (selectedCalendarDates.length === 0) {
      return { allWorking: false, allHolidays: false, isMixed: false };
    }
    const statuses = selectedCalendarDates.map((dateStr) => {
      const d = monthGridData.days.find((x) => x.dateStr === dateStr);
      return d ? d.isWorkingDay : true;
    });
    const allWorking = statuses.every((s) => s === true);
    const allHolidays = statuses.every((s) => s === false);
    return { allWorking, allHolidays, isMixed: !allWorking && !allHolidays };
  }, [selectedCalendarDates, monthGridData]);

  return (
    <div className="pb-16 max-w-7xl mx-auto space-y-6">
      {/* 1. Header with Branch Scope & Sub-Nav Tabs */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 border-b ${isLight ? 'border-slate-200' : 'border-white/[0.08]'} pb-5`}>
        <div>
          <PageHead
            eyebrow="Workforce & Duty Management"
            title="Staff Attendance & Roster"
          />
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs ${isLight ? 'text-slate-600 font-semibold' : 'text-white/60'}`}>
              Managing Branch:
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30">
              <Building2 className="w-3.5 h-3.5" />
              {activeBranch.name} ({activeBranch.code})
            </span>
          </div>
        </div>

        {/* Branch Switcher (Super Admin or Multi-Branch) */}
        <div className="flex flex-wrap items-center gap-3">
          {isSuperAdmin && branches.length > 0 && onSelectBranch && (
            <div className="flex items-center gap-2">
              <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-white/40'} font-medium`}>
                Switch Branch:
              </span>
              <select
                value={effectiveBranchId}
                onChange={(e) => onSelectBranch(e.target.value)}
                className={`rounded-xl px-3 py-2 text-xs font-semibold outline-none cursor-pointer border transition-all ${
                  isLight 
                    ? 'bg-white border-slate-200 text-slate-800 shadow-sm hover:border-slate-300' 
                    : 'bg-black/60 border-white/[0.12] text-white hover:border-white/25'
                }`}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className={isLight ? 'bg-white text-black' : 'bg-[#121214]'}>
                    {b.name} ({b.city})
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === "roster" && (
            <button
              onClick={() => {
                setStaffForm({ name: "", role: "Waiter", department: "Service", phone: "" });
                setIsAddStaffOpen(true);
              }}
              style={{ backgroundColor: themeConfig.primary, color: themeConfig.textOnAccent }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg hover:brightness-110 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Staff Member</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. SUB-NAVIGATION TABS */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/5 border border-white/10 w-fit">
        <button
          onClick={() => setActiveTab("terminal")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
            activeTab === "terminal"
              ? "bg-[#D4AF37] text-black shadow-md font-black"
              : isLight ? "text-slate-600 hover:text-black" : "text-gray-400 hover:text-white"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Live Duty Board</span>
        </button>

        <button
          onClick={() => setActiveTab("roster")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
            activeTab === "roster"
              ? "bg-[#D4AF37] text-black shadow-md font-black"
              : isLight ? "text-slate-600 hover:text-black" : "text-gray-400 hover:text-white"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff Roster & Roles ({staffList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("calendar")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
            activeTab === "calendar"
              ? "bg-[#D4AF37] text-black shadow-md font-black"
              : isLight ? "text-slate-600 hover:text-black" : "text-gray-400 hover:text-white"
          }`}
        >
          <CalendarIcon className="w-4 h-4" />
          <span>Staff Calendar View</span>
        </button>

        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab("working_days")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === "working_days"
                ? "bg-[#D4AF37] text-black shadow-md font-black"
                : isLight ? "text-slate-600 hover:text-black" : "text-gray-400 hover:text-white"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Working Days & Holidays</span>
          </button>
        )}
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 1: LIVE DUTY BOARD & TERMINAL                                      */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === "terminal" && (
        <div className="space-y-6">
          {/* KPI STATS ROW */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Glass className="p-5 flex items-center justify-between">
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-gray-400"}`}>
                  Active On-Duty ({activeBranch.code})
                </p>
                <h3 className="text-2xl font-black mt-1 text-emerald-500">
                  {onDutyCount} <span className="text-xs text-gray-500 font-normal">/ {staffList.length} Staff</span>
                </h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                <UserCheck className="w-6 h-6" />
              </div>
            </Glass>

            <Glass className="p-5 flex items-center justify-between">
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-gray-400"}`}>
                  Off-Duty / Clocked Out
                </p>
                <h3 className="text-2xl font-black mt-1 text-amber-500">
                  {Math.max(0, staffList.length - onDutyCount)} <span className="text-xs text-gray-500 font-normal">Staff</span>
                </h3>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                <Clock className="w-6 h-6" />
              </div>
            </Glass>

            <Glass className="p-5 flex items-center justify-between">
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${isLight ? "text-slate-500" : "text-gray-400"}`}>
                  Shift Events Logged
                </p>
                <h3 className="text-2xl font-black mt-1" style={{ color: themeConfig.primary }}>
                  {logs.length} <span className="text-xs text-gray-500 font-normal">in Selected Span</span>
                </h3>
              </div>
              <div 
                className="w-12 h-12 rounded-2xl border flex items-center justify-center"
                style={{ backgroundColor: themeConfig.light, borderColor: themeConfig.border, color: themeConfig.primary }}
              >
                <Sparkles className="w-6 h-6" />
              </div>
            </Glass>
          </div>

          {/* DATE RANGE FILTER BAR */}
          <Glass className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs font-bold uppercase tracking-wider mr-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                Date Span:
              </span>
              {(["today", "yesterday", "7d", "30d", "custom"] as DateFilterType[]).map((preset) => (
                <button
                  key={preset}
                  onClick={() => setDateFilter(preset)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                    dateFilter === preset
                      ? "bg-[#D4AF37] text-black shadow-sm font-extrabold"
                      : isLight
                        ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                        : "bg-white/5 hover:bg-white/10 text-gray-300"
                  }`}
                >
                  {preset === "today" ? "Today" : preset === "yesterday" ? "Yesterday" : preset === "7d" ? "7 Days" : preset === "30d" ? "30 Days" : "Custom Range"}
                </button>
              ))}
            </div>

            {dateFilter === "custom" && (
              <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-white/10">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">From:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-transparent text-xs font-bold outline-none cursor-pointer"
                  />
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">To:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-transparent text-xs font-bold outline-none cursor-pointer"
                  />
                </div>
                <button
                  onClick={fetchLogs}
                  className="px-3.5 py-1.5 rounded-xl bg-[#D4AF37] text-black text-xs font-bold uppercase tracking-wider hover:brightness-110"
                >
                  Apply
                </button>
              </div>
            )}
          </Glass>

          {/* SEARCH & REMARKS INPUT */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search staff by name, role, department..."
                className={`${inputCls} pl-10 text-xs`}
              />
            </div>

            <div className="w-full sm:w-96">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional shift remarks (e.g., Morning Shift, Late entry approval)..."
                className={`${inputCls} text-xs`}
              />
            </div>
          </div>

          {/* STAFF DUTY CARDS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staffLoading ? (
              <div className="col-span-full py-12 text-center text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#D4AF37]" />
                Loading {activeBranch.name} staff roster...
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="col-span-full py-12 text-center text-gray-400">
                No staff members found matching query. Add staff in the "Staff Roster & Roles" tab.
              </div>
            ) : (
              filteredStaff.map((staff) => {
                const { status, lastLog } = getStaffStatus(staff.id);
                const isOnDuty = status === "on_duty";
                const isActing = actionLoading === staff.id;

                return (
                  <Glass key={staff.id} className="p-5 flex flex-col justify-between hover:border-white/20 transition-all">
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className={`font-bold text-base ${isLight ? "text-slate-900" : "text-white"}`}>
                            {staff.name}
                          </h4>
                          <p className="text-xs text-gray-400 font-medium">
                            <span className="font-semibold text-[#D4AF37]">{staff.role}</span> • {staff.department}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                            isOnDuty
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                          }`}
                        >
                          {isOnDuty ? "● On Duty" : "○ Clocked Out"}
                        </span>
                      </div>

                      {lastLog && (
                        <p className="text-[11px] text-gray-500 mb-4 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          Last event: {new Date(lastLog.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          {lastLog.notes ? ` ("${lastLog.notes}")` : ""}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-white/5 flex gap-2">
                      <button
                        disabled={isOnDuty || isActing}
                        onClick={() => handleClockAction(staff, "clock_in")}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                          isOnDuty
                            ? "opacity-30 cursor-not-allowed bg-white/5 text-gray-500"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 cursor-pointer"
                        }`}
                      >
                        {isActing && !isOnDuty ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
                        Clock In
                      </button>

                      <button
                        disabled={!isOnDuty || isActing}
                        onClick={() => handleClockAction(staff, "clock_out")}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                          !isOnDuty
                            ? "opacity-30 cursor-not-allowed bg-white/5 text-gray-500"
                            : "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 cursor-pointer"
                        }`}
                      >
                        {isActing && isOnDuty ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                        Clock Out
                      </button>
                    </div>
                  </Glass>
                );
              })
            )}
          </div>

          {/* AUDIT LOG TABLE */}
          <div className="mt-8">
            <h3 className={`text-sm font-bold uppercase tracking-wider mb-3 ${isLight ? "text-slate-900" : "text-white"}`}>
              Shift Logs & Audit Trail ({dateFilter === 'custom' ? `${customStartDate} to ${customEndDate}` : dateFilter.toUpperCase()})
            </h3>
            <Glass className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className={`border-b ${isLight ? "border-slate-200 bg-slate-50 text-slate-500" : "border-white/5 bg-white/5 text-gray-400"} uppercase tracking-wider font-extrabold`}>
                    <tr>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4">Branch</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {logsLoading ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-500">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#D4AF37]" />
                          Loading shift logs...
                        </td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-gray-500">
                          No attendance logs found for this date span. Use the Clock In / Clock Out buttons above.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 font-mono text-gray-400">
                            {new Date(log.timestamp).toLocaleDateString("en-IN", { month: "short", day: "2-digit" })} •{" "}
                            {new Date(log.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </td>
                          <td className={`py-3 px-4 font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
                            {log.staff_name}
                          </td>
                          <td className="py-3 px-4 text-gray-400">
                            {log.branch_name || activeBranch.name}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                log.action === "clock_in"
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              }`}
                            >
                              {log.action === "clock_in" ? "Clock In" : "Clock Out"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-400">
                            {log.notes || "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Glass>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 2: STAFF ROSTER & ROLES MANAGEMENT                                 */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === "roster" && (
        <div className="space-y-6">
          <Glass className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#D4AF37]" />
                  Branch Staff Directory • {activeBranch.name}
                </h3>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'} mt-1`}>
                  Add, remove, or modify roles of personnel assigned to this franchise location.
                </p>
              </div>

              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, role, department..."
                  className={`${inputCls} pl-10 text-xs`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {staffList.map((staff) => (
                <div
                  key={staff.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.03] border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-white">{staff.name}</h4>
                      <p className="text-xs text-[#D4AF37] font-semibold mt-0.5">{staff.role}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{staff.department}</p>
                      {staff.phone && (
                        <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {staff.phone}
                        </p>
                      )}
                    </div>

                    <span
                      className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                        staff.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                      }`}
                    >
                      {staff.status}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setEditingStaff(staff)}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300 hover:text-white flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#D4AF37]" />
                      Edit Role
                    </button>

                    <button
                      onClick={() => handleDeleteStaff(staff)}
                      className="py-1.5 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Glass>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 3: STAFF ATTENDANCE CALENDAR VIEW                                  */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === "calendar" && (
        <div className="space-y-6">
          {/* Calendar Controls with Searchable Staff Picker & Specific Date Jump */}
          <Glass className="p-6 relative z-30 overflow-visible">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
              <div className="flex flex-wrap items-end gap-4">
                {/* 1. SEARCHABLE STAFF PICKER */}
                <div ref={staffSearchRef} className="w-full sm:w-80 relative">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center justify-between">
                    <span>Select Staff Member</span>
                    {selectedCalendarStaff && (
                      <span className="text-[10px] text-[#D4AF37] font-semibold">
                        {selectedCalendarStaff.role}
                      </span>
                    )}
                  </label>
                  
                  {/* Search Input Bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#D4AF37]" />
                    <input
                      type="text"
                      value={isStaffSearchOpen ? calendarStaffSearch : (selectedCalendarStaff ? `${selectedCalendarStaff.name} (${selectedCalendarStaff.role})` : calendarStaffSearch)}
                      onFocus={() => {
                        setIsStaffSearchOpen(true);
                        setCalendarStaffSearch("");
                      }}
                      onClick={() => setIsStaffSearchOpen(true)}
                      onChange={(e) => {
                        setCalendarStaffSearch(e.target.value);
                        setIsStaffSearchOpen(true);
                      }}
                      placeholder="Search staff member..."
                      className={`${inputCls} pl-10 pr-8 text-xs font-bold cursor-pointer`}
                    />
                    {isStaffSearchOpen && calendarStaffSearch ? (
                      <button
                        type="button"
                        onClick={() => setCalendarStaffSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 rotate-90 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    )}
                  </div>

                  {/* Dropdown Suggestions List */}
                  {isStaffSearchOpen && (
                    <div className={`absolute top-full left-0 right-0 mt-2 z-50 max-h-72 overflow-y-auto rounded-2xl border shadow-2xl p-2 backdrop-blur-2xl ${
                      isLight ? 'bg-white/95 border-slate-200 shadow-slate-300' : 'bg-[#15151c]/95 border-white/20 shadow-black/90'
                    }`}>
                      <div className="px-2 py-1.5 flex items-center justify-between border-b border-white/10 mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#D4AF37]">
                          {filteredCalendarStaff.length} Members Found
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsStaffSearchOpen(false)}
                          className="text-[10px] text-gray-400 hover:text-white cursor-pointer font-bold px-1 py-0.5"
                        >
                          Close ✕
                        </button>
                      </div>

                      {filteredCalendarStaff.length === 0 ? (
                        <p className="text-xs text-gray-500 py-4 text-center">No staff found</p>
                      ) : (
                        filteredCalendarStaff.map((s) => {
                          const isSelected = s.id === calendarStaffId;
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setCalendarStaffId(s.id);
                                setCalendarStaffSearch("");
                                setIsStaffSearchOpen(false);
                              }}
                              className={`w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between transition-all cursor-pointer mb-1 ${
                                isSelected
                                  ? "bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#D4AF37] font-bold"
                                  : isLight
                                    ? "hover:bg-slate-100 text-slate-800"
                                    : "hover:bg-white/5 text-gray-200"
                              }`}
                            >
                              <div>
                                <p className="font-bold text-xs">{s.name}</p>
                                <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                                  {s.role} • <span className="text-[#D4AF37]/80">{s.department}</span>
                                </p>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-[#D4AF37]" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* 2. CALENDAR MONTH NAVIGATION */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                    Calendar Month
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={handlePrevMonth}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 cursor-pointer transition-all"
                      title="Previous Month"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-serif font-black text-sm text-[#D4AF37] px-3 min-w-32 text-center">
                      {new Date(`${calendarMonth}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                    </span>
                    <button
                      onClick={handleNextMonth}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 cursor-pointer transition-all"
                      title="Next Month"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 3. CALENDAR DROP-DOWN TO CHOOSE SPECIFIC DATE DIRECTLY */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1">
                    <CalendarDays className="w-3 h-3 text-[#D4AF37]" />
                    Jump to Specific Date
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-[#D4AF37]/50 transition-all cursor-pointer">
                    <CalendarIcon className="w-4 h-4 text-[#D4AF37] shrink-0" />
                    <input
                      type="date"
                      value={selectedSpecificDate}
                      onChange={(e) => handleJumpToDate(e.target.value)}
                      className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                    />
                    {selectedSpecificDate && (
                      <button
                        onClick={() => setSelectedSpecificDate("")}
                        className="text-gray-400 hover:text-white ml-1"
                        title="Clear Date Highlight"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Monthly Summary Statistics */}
              {selectedCalendarStaff && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="px-4 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                    <p className="text-[10px] uppercase font-bold text-emerald-400">Days Worked</p>
                    <p className="text-xl font-black text-emerald-400">
                      {monthGridData.workedDaysCount} <span className="text-xs font-normal text-gray-400">/ {monthGridData.officialWorkingDaysCount}</span>
                    </p>
                  </div>

                  <div className="px-4 py-2.5 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-center">
                    <p className="text-[10px] uppercase font-bold text-[#D4AF37]">Attendance Rate</p>
                    <p className="text-xl font-black text-[#D4AF37]">{monthGridData.attendanceRate}%</p>
                  </div>

                  <div className="px-4 py-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-center">
                    <p className="text-[10px] uppercase font-bold text-blue-400">Est. Shift Hours</p>
                    <p className="text-xl font-black text-blue-400">{monthGridData.totalShiftHours}h</p>
                  </div>
                </div>
              )}
            </div>

            {/* SELECTED SPECIFIC DATE BREAKDOWN BANNER */}
            {selectedDateBreakdown && (
              <div className="mt-5 p-4 rounded-2xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#D4AF37] text-black font-black flex items-center justify-center text-sm">
                    {selectedDateBreakdown.dayNumber}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Selected Day Details: {new Date(selectedDateBreakdown.dateStr).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    </h4>
                    <p className="text-xs text-gray-300 mt-0.5">
                      Status:{" "}
                      <span className={selectedDateBreakdown.isWorked ? "text-emerald-400 font-bold" : "text-gray-400"}>
                        {selectedDateBreakdown.isWorked ? "● Clocked In / Worked" : "○ No shift entries logged"}
                      </span>
                      {" • "}
                      Schedule:{" "}
                      <span className={selectedDateBreakdown.isWorkingDay ? "text-emerald-300" : "text-blue-300 font-semibold"}>
                        {selectedDateBreakdown.isWorkingDay ? "Official Working Day" : `Holiday: ${selectedDateBreakdown.override?.reason || 'Non-Working Day'}`}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-gray-400">
                    {selectedDateBreakdown.dayLogs.length} events logged
                  </span>
                  <button
                    onClick={() => setSelectedSpecificDate("")}
                    className="px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white cursor-pointer"
                  >
                    Clear Focus
                  </button>
                </div>
              </div>
            )}
          </Glass>

          {/* MONTHLY CALENDAR GRID */}
          <Glass className="p-6 relative z-10">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-2 mb-3 text-center">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName, idx) => (
                <div
                  key={dayName}
                  className={`text-[11px] font-extrabold uppercase tracking-wider py-2 ${
                    idx === 0 || idx === 6 ? "text-amber-500/70" : "text-gray-400"
                  }`}
                >
                  {dayName}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-2">
              {/* Empty padding days */}
              {Array.from({ length: monthGridData.firstDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-24 rounded-2xl bg-transparent" />
              ))}

              {/* Month Day Cells */}
              {monthGridData.days.map((cell) => {
                const isHoliday = !cell.isWorkingDay;
                const isWorked = cell.isWorked;
                const isFocused = selectedSpecificDate === cell.dateStr;

                return (
                  <div
                    key={cell.dateStr}
                    onClick={() => setSelectedSpecificDate(cell.dateStr)}
                    className={`min-h-24 p-2.5 rounded-2xl border flex flex-col justify-between transition-all cursor-pointer hover:border-[#D4AF37]/60 ${
                      isFocused
                        ? "ring-2 ring-[#D4AF37] shadow-[0_0_25px_rgba(212,175,55,0.4)] scale-[1.02] bg-[#D4AF37]/10 border-[#D4AF37]"
                        : isWorked
                          ? "bg-emerald-500/[0.08] border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                          : isHoliday
                            ? "bg-blue-500/[0.05] border-blue-500/20"
                            : isLight
                              ? "bg-slate-50 border-slate-200"
                              : "bg-white/[0.02] border-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-black ${isFocused ? "text-[#D4AF37]" : isWorked ? "text-emerald-400" : isHoliday ? "text-blue-400" : "text-gray-300"}`}>
                        {cell.dayNumber}
                      </span>
                      {isWorked ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                      ) : isHoliday ? (
                        <span className="text-[9px] font-bold uppercase text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                          Holiday
                        </span>
                      ) : isFocused ? (
                        <span className="text-[9px] font-bold uppercase text-[#D4AF37] bg-[#D4AF37]/20 px-1 py-0.5 rounded">
                          Selected
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 text-[10px]">
                      {isWorked ? (
                        <div className="space-y-0.5">
                          <p className="font-bold text-emerald-400 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Worked
                          </p>
                          <p className="text-gray-400 font-mono text-[9px]">
                            {cell.dayLogs.length} events logged
                          </p>
                        </div>
                      ) : isHoliday ? (
                        <p className="text-blue-300/80 font-medium text-[10px] leading-tight line-clamp-2">
                          {cell.override?.reason || "Hotel Holiday"}
                        </p>
                      ) : (
                        <p className="text-gray-500 text-[10px]">Off / Absent</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Glass>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 4: SUPER ADMIN WORKING DAYS & HOLIDAY CALENDAR GOVERNANCE          */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === "working_days" && isSuperAdmin && (
        <div className="space-y-6">
          {/* Super Admin Convenience Control Panel */}
          <Glass className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-white/10 pb-5">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-[#D4AF37]" />
                  Super Admin Working Days & Holiday Governance
                </h3>
                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'} mt-1`}>
                  Exclusive to Super Admin. Configure official operating days and holidays in 1-click or multi-select dates.
                </p>
              </div>

              {/* Month Navigation & Jump-To-Date Picker */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevMonth}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-serif font-black text-sm text-[#D4AF37] px-3 min-w-32 text-center">
                  {new Date(`${calendarMonth}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                </span>
                <button
                  onClick={handleNextMonth}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 ml-2">
                  <CalendarDays className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <input
                    type="date"
                    onChange={(e) => handleJumpToDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                    title="Jump to date"
                  />
                </div>
              </div>
            </div>

            {/* MULTI-DAY DATE RANGE HOLIDAY SETTER */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 max-w-2xl">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#D4AF37] mb-2 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                Quick Date Range Holiday Setter
              </p>
              <div className="flex flex-col sm:flex-row gap-2 mb-2.5">
                <div className="flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">From:</span>
                  <input
                    type="date"
                    value={rangeHolidayStart}
                    onChange={(e) => setRangeHolidayStart(e.target.value)}
                    className="bg-transparent text-xs font-bold outline-none cursor-pointer w-full"
                  />
                </div>
                <div className="flex-1 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                  <span className="text-[10px] text-gray-400 font-bold uppercase">To:</span>
                  <input
                    type="date"
                    value={rangeHolidayEnd}
                    onChange={(e) => setRangeHolidayEnd(e.target.value)}
                    className="bg-transparent text-xs font-bold outline-none cursor-pointer w-full"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Holiday Reason (e.g. Diwali Vacation, Renovation)..."
                  value={rangeHolidayReason}
                  onChange={(e) => setRangeHolidayReason(e.target.value)}
                  className={`${inputCls} text-xs py-1.5 flex-1`}
                />
                <button
                  type="button"
                  disabled={batchUpdating}
                  onClick={() => handleApplyRangeHoliday(false)}
                  className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold whitespace-nowrap transition-all cursor-pointer shadow-md"
                >
                  Set as Holiday / Off
                </button>
                <button
                  type="button"
                  disabled={batchUpdating}
                  onClick={() => handleApplyRangeHoliday(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold whitespace-nowrap transition-all cursor-pointer"
                >
                  Reset Range
                </button>
              </div>
            </div>

            {/* ARITHMETIC SELECTION BAR & INTELLIGENT ACTION CONTROLS */}
            {selectedCalendarDates.length > 0 ? (
              <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/40 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#D4AF37] text-black font-black flex items-center justify-center text-sm shadow">
                    {selectedCalendarDates.length}
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">
                      {selectedCalendarDates.length === 1
                        ? `1 Date Selected (${new Date(selectedCalendarDates[0] + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })})`
                        : `${selectedCalendarDates.length} Dates Selected`}
                    </h4>
                    <p className="text-[11px] text-gray-300 mt-0.5">
                      {selectedStatuses.allWorking
                        ? "Currently all selected dates are Operating Working Days."
                        : selectedStatuses.allHolidays
                          ? "Currently all selected dates are Holidays / Weekly Offs."
                          : "Selected dates include a mix of working days and holidays."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Case 1: All selected dates are Working Days -> ONLY offer Mark as Holiday (NEVER set as working day) */}
                  {selectedStatuses.allWorking && (
                    <button
                      type="button"
                      disabled={batchUpdating}
                      onClick={() => setHolidayModalOpen(true)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
                    >
                      <CalendarX className="w-4 h-4" />
                      Mark {selectedCalendarDates.length === 1 ? "as Holiday / Off" : `all ${selectedCalendarDates.length} Days as Holiday / Off`}
                    </button>
                  )}

                  {/* Case 2: All selected dates are Holidays -> ONLY offer Restore as Working Day (NEVER set as holiday) */}
                  {selectedStatuses.allHolidays && (
                    <button
                      type="button"
                      disabled={batchUpdating}
                      onClick={handleRestoreWorkingDays}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
                    >
                      <CalendarCheck className="w-4 h-4" />
                      Restore {selectedCalendarDates.length === 1 ? "as Working Day" : `all ${selectedCalendarDates.length} Days as Working Day`}
                    </button>
                  )}

                  {/* Case 3: Mixed selection */}
                  {selectedStatuses.isMixed && (
                    <>
                      <button
                        type="button"
                        disabled={batchUpdating}
                        onClick={() => setHolidayModalOpen(true)}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <CalendarX className="w-4 h-4" />
                        Mark All as Holiday
                      </button>
                      <button
                        type="button"
                        disabled={batchUpdating}
                        onClick={handleRestoreWorkingDays}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <CalendarCheck className="w-4 h-4" />
                        Restore All as Working
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedCalendarDates([])}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-gray-300 hover:text-white transition-all cursor-pointer"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
                <p className="flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#D4AF37]" />
                  Click on any date or multiple dates on the calendar below to select them.
                </p>
                <span className="text-[11px] text-gray-500 font-mono">0 Dates Selected</span>
              </div>
            )}
          </Glass>

          {/* SUPER ADMIN MONTHLY CALENDAR GRID */}
          <Glass className="p-6">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-2 mb-3 text-center">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((dayName, idx) => (
                <div
                  key={dayName}
                  className={`text-[11px] font-extrabold uppercase tracking-wider py-2 ${
                    idx === 0 || idx === 6 ? "text-amber-500/70" : "text-gray-400"
                  }`}
                >
                  {dayName}
                </div>
              ))}
            </div>

            {/* Month Day Cells */}
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: monthGridData.firstDayIndex }).map((_, i) => (
                <div key={`cal-empty-${i}`} className="min-h-24 rounded-2xl bg-transparent" />
              ))}

              {monthGridData.days.map((cell) => {
                const isWorking = cell.isWorkingDay;
                const isSelectedInBatch = selectedCalendarDates.includes(cell.dateStr);

                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    onClick={() => {
                      setSelectedCalendarDates((prev) =>
                        prev.includes(cell.dateStr)
                          ? prev.filter((d) => d !== cell.dateStr)
                          : [...prev, cell.dateStr]
                      );
                    }}
                    className={`min-h-24 p-3 rounded-2xl border text-left flex flex-col justify-between transition-all hover:scale-[1.02] cursor-pointer ${
                      isSelectedInBatch
                        ? "ring-2 ring-[#D4AF37] border-[#D4AF37] bg-[#D4AF37]/25 shadow-[0_0_20px_rgba(212,175,55,0.35)]"
                        : isWorking
                          ? "bg-emerald-500/[0.06] border-emerald-500/20 hover:border-emerald-500/50"
                          : "bg-blue-500/[0.08] border-blue-500/30 hover:border-blue-500/60"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-xs font-black ${isSelectedInBatch ? "text-[#D4AF37]" : isWorking ? "text-emerald-400" : "text-blue-400"}`}>
                        {cell.dayNumber}
                      </span>
                      <span
                        className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                          isSelectedInBatch
                            ? "bg-[#D4AF37] text-black font-black"
                            : isWorking
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-blue-500/10 text-blue-400"
                        }`}
                      >
                        {isSelectedInBatch ? "✓ Selected" : isWorking ? "Working" : "Holiday"}
                      </span>
                    </div>

                    <div className="mt-2 text-[10px]">
                      {cell.override?.reason ? (
                        <p className="font-semibold text-white/80 line-clamp-2">
                          {cell.override.reason}
                        </p>
                      ) : (
                        <p className="text-gray-500">
                          {isWorking ? "Regular Schedule" : "Weekend Off"}
                        </p>
                      )}
                      <p className="text-[9px] text-[#D4AF37] mt-1 font-bold">
                        {isSelectedInBatch ? "Click to deselect" : "Click to select"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </Glass>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 1: ADD NEW STAFF MEMBER                                          */}
      {/* ---------------------------------------------------------------------- */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#121216] p-6 sm:p-8 shadow-2xl">
            <button
              onClick={() => setIsAddStaffOpen(false)}
              className="absolute top-6 right-6 p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#D4AF37]">
                Workforce Onboarding
              </span>
              <h3 className="text-xl font-bold text-white mt-1">Add Staff to {activeBranch.name}</h3>
            </div>

            <form onSubmit={handleAddStaffSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-300 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  className={`${inputCls} text-xs`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-300 mb-1.5">
                  Assigned Role *
                </label>
                <select
                  value={staffForm.role}
                  onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                  className={`${inputCls} text-xs cursor-pointer`}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r} className="bg-[#121216] text-white">
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-300 mb-1.5">
                  Department
                </label>
                <select
                  value={staffForm.department}
                  onChange={(e) => setStaffForm({ ...staffForm, department: e.target.value })}
                  className={`${inputCls} text-xs cursor-pointer`}
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d} className="bg-[#121216] text-white">
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-300 mb-1.5">
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="+91 98000 00000"
                  value={staffForm.phone}
                  onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                  className={`${inputCls} text-xs`}
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-xs font-bold uppercase text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-[#D4AF37] text-black text-xs font-extrabold uppercase hover:brightness-110 shadow-lg"
                >
                  Add Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 2: EDIT STAFF ROLE & DETAILS                                     */}
      {/* ---------------------------------------------------------------------- */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#121216] p-6 sm:p-8 shadow-2xl">
            <button
              onClick={() => setEditingStaff(null)}
              className="absolute top-6 right-6 p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#D4AF37]">
                Staff Role Configuration
              </span>
              <h3 className="text-xl font-bold text-white mt-1">Edit {editingStaff.name}</h3>
            </div>

            <form onSubmit={handleUpdateStaffSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-300 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editingStaff.name}
                  onChange={(e) => setEditingStaff({ ...editingStaff, name: e.target.value })}
                  className={`${inputCls} text-xs`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-300 mb-1.5">
                  Role
                </label>
                <select
                  value={editingStaff.role}
                  onChange={(e) => setEditingStaff({ ...editingStaff, role: e.target.value })}
                  className={`${inputCls} text-xs cursor-pointer`}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r} className="bg-[#121216] text-white">
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-300 mb-1.5">
                  Department
                </label>
                <select
                  value={editingStaff.department}
                  onChange={(e) => setEditingStaff({ ...editingStaff, department: e.target.value })}
                  className={`${inputCls} text-xs cursor-pointer`}
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d} className="bg-[#121216] text-white">
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-300 mb-1.5">
                  Phone
                </label>
                <input
                  type="text"
                  value={editingStaff.phone || ""}
                  onChange={(e) => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                  className={`${inputCls} text-xs`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-300 mb-1.5">
                  Duty Status
                </label>
                <select
                  value={editingStaff.status}
                  onChange={(e) => setEditingStaff({ ...editingStaff, status: e.target.value as "active" | "inactive" })}
                  className={`${inputCls} text-xs cursor-pointer`}
                >
                  <option value="active" className="bg-[#121216] text-white">Active</option>
                  <option value="inactive" className="bg-[#121216] text-white">Inactive</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-xs font-bold uppercase text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-[#D4AF37] text-black text-xs font-extrabold uppercase hover:brightness-110 shadow-lg"
                >
                  Save Role Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 3: MARK DATES AS HOLIDAY / OFF (SUPER ADMIN)                     */}
      {/* ---------------------------------------------------------------------- */}
      {holidayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#121216] p-6 sm:p-8 shadow-2xl">
            <button
              onClick={() => setHolidayModalOpen(false)}
              className="absolute top-6 right-6 p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#D4AF37]">
                Super Admin Day Governance
              </span>
              <h3 className="text-xl font-bold text-white mt-1">
                Mark as Holiday / Off
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {selectedCalendarDates.length === 1
                  ? `Configuring date: ${selectedCalendarDates[0]}`
                  : `Applying to ${selectedCalendarDates.length} selected dates`}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-300 mb-1.5">
                  Holiday / Off Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g., Weekly Off, Diwali Celebration, Hotel Maintenance..."
                  value={holidayReasonInput}
                  onChange={(e) => setHolidayReasonInput(e.target.value)}
                  className={`${inputCls} text-xs`}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-gray-400 mb-1.5">
                  Quick Presets:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {["Weekly Off", "National Holiday", "Festival Closure", "Maintenance & Cleaning"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setHolidayReasonInput(preset)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                        holidayReasonInput === preset
                          ? "bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]"
                          : "bg-white/5 border-white/10 text-gray-300 hover:text-white"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setHolidayModalOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-xs font-bold uppercase text-gray-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={batchUpdating}
                  onClick={async () => {
                    await handleBatchCalendarUpdate(
                      selectedCalendarDates,
                      false,
                      holidayReasonInput.trim() || "Holiday / Off"
                    );
                    setHolidayModalOpen(false);
                  }}
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold uppercase shadow-lg shadow-blue-500/20 cursor-pointer"
                >
                  Confirm Holiday
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
