import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Users, Briefcase, Calendar, ArrowUpDown, Edit2, Search, X, Download, Trash2, Check, Plus, UserPlus, Filter, MoreVertical, AlertCircle, AlertTriangle, CheckCircle2, UsersRound, UserCog, User, Mail, Building2, Clock, MessageSquare, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import type { Project, ProjectLead, TeamMember, InsertProject, Person, TeamMemberAssignment, ProjectRole } from '@shared/schema';

type SortOrder = 'asc' | 'desc';
type SortField = 'endDate' | 'startDate';

interface ProjectsDashboardProps {
  shouldClearFilters?: boolean;
  onFiltersClear?: () => void;
}

export default function ProjectsDashboard({ shouldClearFilters, onFiltersClear }: ProjectsDashboardProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const permissions = usePermissions();
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ['/api/projects'] });
  const { data: projectLeads = [] } = useQuery<ProjectLead[]>({ queryKey: ['/api/project-leads'] });
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({ queryKey: ['/api/team-members'] });
  const { data: projectRoles = [] } = useQuery<ProjectRole[]>({ queryKey: ['/api/project-roles'] });
  const [filterLeads, setFilterLeads] = useState<string[]>([]);
  const [filterMembers, setFilterMembers] = useState<string[]>([]);
  const [filterProjectName, setFilterProjectName] = useState<string>('');
  const [filterMemberSearch, setFilterMemberSearch] = useState<string>('');
  const [filterLeadSearch, setFilterLeadSearch] = useState<string>('');
  const [filterProjectStatus, setFilterProjectStatus] = useState<string[]>([]);
  const [filterProjectsWithCaution, setFilterProjectsWithCaution] = useState(false);
  const [filterEndDateAfter, setFilterEndDateAfter] = useState<string>(''); // Filter for end date > selected date
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [sortField, setSortField] = useState<SortField>('endDate');
  
  // Bulk selection state - selection mode toggle
  const [selectionModeProjects, setSelectionModeProjects] = useState(false);
  const [selectionModeMembers, setSelectionModeMembers] = useState(false);
  const [selectionModeLeads, setSelectionModeLeads] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [showBulkDeleteProjects, setShowBulkDeleteProjects] = useState(false);
  const [showBulkDeleteMembers, setShowBulkDeleteMembers] = useState(false);
  const [showBulkDeleteLeads, setShowBulkDeleteLeads] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    customer: '',
    customerContactEmail: '',
    contractualHours: '',
    contractualMinutes: '',
    leadIds: [] as string[],
    teamMembers: [] as TeamMemberAssignment[],
    startDate: '',
    endDate: '',
    projectType: '' as string,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [jiraProjectKey, setJiraProjectKey] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [editMemberValue, setEditMemberValue] = useState('');
  const [editLeadValue, setEditLeadValue] = useState('');
  const [editLeadEmailValue, setEditLeadEmailValue] = useState('');
  const [showEditLeadDialog, setShowEditLeadDialog] = useState(false);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

  // Add Project Modal State
  const [showAddProjectDialog, setShowAddProjectDialog] = useState(false);
  const [projectFormData, setProjectFormData] = useState({
    name: '',
    customer: '',
    customerContactEmail: '',
    contractualHours: '',
    contractualMinutes: '',
    leadIds: [] as string[],
    teamMembers: [] as TeamMemberAssignment[],
    startDate: '',
    endDate: '',
    projectType: '' as string,
  });
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [projectFormErrors, setProjectFormErrors] = useState<Record<string, string>>({});

  // Add Team Member Modal State
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [newMember, setNewMember] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [editMemberEmailValue, setEditMemberEmailValue] = useState('');
  const [showEditMemberDialog, setShowEditMemberDialog] = useState(false);
  const [memberNameError, setMemberNameError] = useState<string | null>(null);
  const [memberNameWarning, setMemberNameWarning] = useState<string | null>(null);

  // Add Project Lead Modal State
  const [showAddLeadDialog, setShowAddLeadDialog] = useState(false);
  const [newLead, setNewLead] = useState('');
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [leadNameError, setLeadNameError] = useState<string | null>(null);
  const [leadNameWarning, setLeadNameWarning] = useState<string | null>(null);

  // Project name validation state
  const [projectNameError, setProjectNameError] = useState<string | null>(null);
  const [projectNameWarning, setProjectNameWarning] = useState<string | null>(null);

  // Pagination state - show items in batches
  const [projectsToShow, setProjectsToShow] = useState(8);
  const [membersToShow, setMembersToShow] = useState(15);
  const [leadsToShow, setLeadsToShow] = useState(15);

  // Date input display state (MM/DD/YYYY format for user input)
  const [projectStartDateInput, setProjectStartDateInput] = useState('');
  const [projectEndDateInput, setProjectEndDateInput] = useState('');
  const [editStartDateInput, setEditStartDateInput] = useState('');
  const [editEndDateInput, setEditEndDateInput] = useState('');

  // Lead Detail Modal State
  const [selectedLeadForDetail, setSelectedLeadForDetail] = useState<Person | null>(null);
  const [showLeadDetailModal, setShowLeadDetailModal] = useState(false);

  // Team Member Detail Modal State
  const [selectedMemberForDetail, setSelectedMemberForDetail] = useState<Person | null>(null);
  const [showMemberDetailModal, setShowMemberDetailModal] = useState(false);

  // Expanded contracts state for detail modals
  const [showAllLeadContracts, setShowAllLeadContracts] = useState(false);
  const [showAllMemberContracts, setShowAllMemberContracts] = useState(false);

  // Check if logged-in user is a registered team member or lead (can submit feedback)
  const isUserRegisteredTeamMember = teamMembers.some(
    (m) => m.email?.toLowerCase() === user?.email?.toLowerCase()
  );
  const isUserRegisteredLead = projectLeads.some(
    (l) => l.email?.toLowerCase() === user?.email?.toLowerCase()
  );
  const canSubmitFeedback = isUserRegisteredTeamMember || isUserRegisteredLead;

  // Feedback Form State for detail modals (anonymous submission)
  const [leadFeedbackValue, setLeadFeedbackValue] = useState('');
  const [memberFeedbackValue, setMemberFeedbackValue] = useState('');

  // Team Member Role Filter State
  const [filterMemberRoles, setFilterMemberRoles] = useState<string[]>([]);
  const [memberRoleSearchQuery, setMemberRoleSearchQuery] = useState('');

  // Role selection state for add/edit project forms
  const [roleInputs, setRoleInputs] = useState<Record<string, string>>({}); // Keyed by popover id
  const [showAddRolePopover, setShowAddRolePopover] = useState<string | null>(null); // popover id or null
  const hasAttemptedSeed = useRef(false);

  // Project Detail Modal State
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showProjectDetailModal, setShowProjectDetailModal] = useState(false);

  // Email display toggle state - track which leads' emails are visible (supports multiple)
  const [visibleLeadEmails, setVisibleLeadEmails] = useState<Set<string>>(new Set());

  // Effect to clear all filters when triggered from parent (Active Projects tile)
  useEffect(() => {
    if (shouldClearFilters) {
      setFilterLeads([]);
      setFilterMembers([]);
      setFilterProjectName('');
      setFilterProjectStatus([]);
      setFilterProjectsWithCaution(false);
      onFiltersClear?.();
    }
  }, [shouldClearFilters, onFiltersClear]);

  const totalTeamMembers = teamMembers.length;
  const totalLeads = projectLeads.length;

  const getLeadName = (leadId: string) => {
    return projectLeads.find((l) => l.id === leadId)?.name || 'Unknown';
  };

  const getLeadById = (leadId: string) => {
    return projectLeads.find((l) => l.id === leadId);
  };

  // Get all lead names for a project (supports co-leads)
  const getProjectLeadNames = (project: Project): string => {
    const leadIdsArray = project.leadIds && project.leadIds.length > 0 
      ? project.leadIds 
      : [project.leadId];
    const names = leadIdsArray
      .map(id => projectLeads.find(l => l.id === id)?.name)
      .filter(Boolean) as string[];
    return names.join(' & ') || 'Unknown';
  };

  // Check if project has co-leads
  const hasCoLeads = (project: Project): boolean => {
    return project.leadIds && project.leadIds.length > 1;
  };

  const handleProjectClick = (project: Project) => {
    if (!selectionModeProjects && !editingProject) {
      setSelectedProject(project);
      setShowProjectDetailModal(true);
      setVisibleLeadEmails(new Set());
    }
  };

  const closeProjectDetailModal = () => {
    setShowProjectDetailModal(false);
    setSelectedProject(null);
    setVisibleLeadEmails(new Set());
  };

  const toggleLeadEmailVisibility = (leadId: string) => {
    setVisibleLeadEmails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };

  // Helper to get team member names from the new structure
  const getTeamMemberNames = (assignments: TeamMemberAssignment[] | unknown) => {
    const teamMemberAssignments = (assignments as TeamMemberAssignment[]) || [];
    return teamMemberAssignments
      .map((a) => teamMembers.find((m) => m.id === a.memberId)?.name)
      .filter(Boolean);
  };

  // Helper to get team member details with roles
  const getTeamMembersWithRoles = (assignments: TeamMemberAssignment[] | unknown) => {
    const teamMemberAssignments = (assignments as TeamMemberAssignment[]) || [];
    return teamMemberAssignments
      .map((a) => {
        const member = teamMembers.find((m) => m.id === a.memberId);
        return member ? { name: member.name, role: a.role || '' } : null;
      })
      .filter(Boolean) as { name: string; role: string }[];
  };

  // Helper to get member IDs from assignments for filtering
  const getMemberIdsFromProject = (project: Project): string[] => {
    const assignments = (project.teamMembers as TeamMemberAssignment[]) || [];
    return assignments.map(a => a.memberId);
  };

  // Get project status based on end date
  // 'active' = Green (end date far), 'renewal' = Yellow/Caution (within 2 months or missing), 'ended' = Red (past end date)
  const getProjectStatus = (endDate: string | null | undefined): 'active' | 'renewal' | 'ended' => {
    if (!endDate) return 'renewal'; // Missing end date = renewal soon
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'ended';
    if (diffDays <= 60) return 'renewal'; // Within 2 months
    return 'active';
  };

  const getStatusPriority = (status: 'active' | 'renewal' | 'ended'): number => {
    if (status === 'renewal') return 0; // Active but renewal soon - first
    if (status === 'active') return 1;  // Active with no renewal soon - second
    return 2;                            // Ended - last
  };

  // Format date from YYYY-MM-DD to MM/DD/YYYY for display
  const formatDisplayDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'N/A';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${month}/${day}/${year}`;
  };

  // Format date from YYYY-MM-DD to MM/DD/YYYY for input fields
  const formatInputDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [year, month, day] = parts;
    return `${month}/${day}/${year}`;
  };

  // Parse date from MM/DD/YYYY to YYYY-MM-DD for storage
  const parseInputDate = (inputValue: string): string => {
    if (!inputValue) return '';
    const parts = inputValue.split('/');
    if (parts.length !== 3) return '';
    const [month, day, year] = parts;
    if (!month || !day || !year) return '';
    const m = month.padStart(2, '0');
    const d = day.padStart(2, '0');
    const y = year.length === 2 ? `20${year}` : year;
    return `${y}-${m}-${d}`;
  };

  // Validate date format (MM/DD/YYYY)
  const isValidDateFormat = (value: string): boolean => {
    if (!value) return true;
    const regex = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/(\d{2}|\d{4})$/;
    return regex.test(value);
  };

  // Auto-format date input with slashes (MM/DD/YYYY)
  const formatDateInput = (value: string): string => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    
    // Build formatted string with slashes
    let formatted = '';
    if (digits.length > 0) {
      formatted = digits.substring(0, 2);
    }
    if (digits.length > 2) {
      formatted += '/' + digits.substring(2, 4);
    }
    if (digits.length > 4) {
      formatted += '/' + digits.substring(4, 8);
    }
    return formatted;
  };

  // Validate start date is not in the future
  const validateStartDate = (dateInput: string): string | null => {
    if (!dateInput || !isValidDateFormat(dateInput)) return null;
    const parsed = parseInputDate(dateInput);
    if (!parsed) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(parsed);
    startDate.setHours(0, 0, 0, 0);
    
    if (startDate > today) {
      return 'Start date cannot be in the future';
    }
    return null;
  };

  // Validate end date is after start date and after current date
  const validateEndDate = (startInput: string, endInput: string): string | null => {
    if (!endInput || !isValidDateFormat(endInput)) return null;
    const endParsed = parseInputDate(endInput);
    if (!endParsed) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(endParsed);
    endDate.setHours(0, 0, 0, 0);
    
    // End date must be after today
    if (endDate <= today) {
      return 'End date must be in the future';
    }
    
    // If start date is valid, end date must be after start date
    if (startInput && isValidDateFormat(startInput)) {
      const startParsed = parseInputDate(startInput);
      if (startParsed) {
        const startDate = new Date(startParsed);
        startDate.setHours(0, 0, 0, 0);
        if (endDate <= startDate) {
          return 'End date must be after start date';
        }
      }
    }
    return null;
  };

  // Helper to convert stored value to hours and minutes
  // Legacy data was stored as hours (e.g., "40" = 40 hours)
  // New data is stored as total minutes (e.g., "2400" = 40 hours)
  // Heuristic: values < 1000 are likely legacy hours, >= 1000 are total minutes
  const parseContractualTime = (storedValue: string | null | undefined): { hours: string; minutes: string } => {
    if (!storedValue) return { hours: '', minutes: '' };
    const value = parseInt(storedValue, 10);
    if (isNaN(value)) return { hours: '', minutes: '' };
    
    // Legacy detection: if value < 1000, it's likely stored as hours (not minutes)
    // 1000 minutes = ~16.6 hours, so values under 1000 are ambiguous
    // Most contracts are 10-500 hours, so legacy values would be in that range
    if (value < 1000) {
      // Treat as legacy hours - return as hours with no minutes
      return { hours: value.toString(), minutes: '' };
    }
    
    // New format: total minutes
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return { hours: hours.toString(), minutes: minutes > 0 ? minutes.toString() : '' };
  };

  // Helper to convert hours and minutes to total minutes string
  const toTotalMinutes = (hours: string, minutes: string): string => {
    const h = parseInt(hours, 10) || 0;
    const m = parseInt(minutes, 10) || 0;
    if (h === 0 && m === 0) return '';
    return (h * 60 + m).toString();
  };

  // Helper to format stored value for display as "X hours Y minutes"
  // Uses same legacy detection as parseContractualTime
  const formatContractualTime = (storedValue: string | null | undefined): string => {
    if (!storedValue) return '';
    const value = parseInt(storedValue, 10);
    if (isNaN(value)) return storedValue; // fallback for non-numeric data
    
    // Legacy detection: values < 1000 are likely stored as hours
    if (value < 1000) {
      return `${value} hour${value !== 1 ? 's' : ''}`;
    }
    
    // New format: total minutes
    const hours = Math.floor(value / 60);
    const mins = value % 60;
    if (hours > 0 && mins > 0) return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    if (mins > 0) return `${mins} minute${mins !== 1 ? 's' : ''}`;
    return '';
  };

  // Helper to check if a project has unfilled team member roles
  const projectHasUnfilledRoles = (project: Project): boolean => {
    const assignments = (project.teamMembers as TeamMemberAssignment[]) || [];
    return assignments.some(a => !a.role || a.role.trim() === '');
  };

  // Helper to check if a project has caution (missing end date OR unfilled team member roles OR missing contractual hours OR missing customer email)
  const projectHasCaution = (project: Project): boolean => {
    // Check for missing end date
    if (!project.endDate) return true;
    
    // Check for unfilled team member roles
    if (projectHasUnfilledRoles(project)) return true;
    
    // Check for missing contractual hours
    if (!project.totalContractualHours) return true;
    
    // Check for missing customer contact email
    if (!project.customerContactEmail) return true;
    
    return false;
  };

  const filteredProjects = projects.filter((project) => {
    // Get all leads for this project (support both legacy leadId and new leadIds array)
    const projectLeadIds = project.leadIds && project.leadIds.length > 0 
      ? project.leadIds 
      : [project.leadId];
    if (filterLeads.length > 0 && !filterLeads.some(leadId => projectLeadIds.includes(leadId))) return false;
    const projectMemberIds = getMemberIdsFromProject(project);
    if (filterMembers.length > 0 && !filterMembers.some(memberId => projectMemberIds.includes(memberId))) return false;
    if (filterProjectName && !project.name.toLowerCase().includes(filterProjectName.toLowerCase())) return false;
    if (filterProjectStatus.length > 0 && !filterProjectStatus.includes(getProjectStatus(project.endDate))) return false;
    // Filter by projects with caution (missing end date OR unfilled roles)
    if (filterProjectsWithCaution && !projectHasCaution(project)) return false;
    // Filter by end date after selected date (include projects with no end date)
    if (filterEndDateAfter) {
      const filterDate = new Date(filterEndDateAfter);
      // Include if no end date (N/A) OR end date is after the filter date
      if (project.endDate) {
        const projectEndDate = new Date(project.endDate);
        if (projectEndDate <= filterDate) return false;
      }
      // Projects with no end date are included (they pass the filter)
    }
    return true;
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    const statusA = getProjectStatus(a.endDate);
    const statusB = getProjectStatus(b.endDate);
    
    // First sort by status priority
    const statusPriorityA = getStatusPriority(statusA);
    const statusPriorityB = getStatusPriority(statusB);
    
    if (statusPriorityA !== statusPriorityB) {
      return statusPriorityA - statusPriorityB;
    }
    
    // Within same status, sort by end date (earliest first)
    const dateA = a.endDate ? new Date(a.endDate).getTime() : Infinity;
    const dateB = b.endDate ? new Date(b.endDate).getTime() : Infinity;
    return dateA - dateB;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };
  
  // Filter member search results
  const filteredMembersForFilter = teamMembers
    .filter((member) => member.name.toLowerCase().includes(filterMemberSearch.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));
  
  // Toggle lead in filter
  const toggleLeadFilter = (leadId: string) => {
    setFilterLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };
  
  // Toggle member in filter
  const toggleMemberFilter = (memberId: string) => {
    setFilterMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const projectStatusOptions = [
    { value: 'active', label: 'Active with no renewal soon', color: 'bg-green-500' },
    { value: 'renewal', label: 'Active but renewal soon', color: 'bg-yellow-500' },
    { value: 'ended', label: 'Ended', color: 'bg-red-500' },
  ];

  const toggleProjectStatusFilter = (status: string) => {
    setFilterProjectStatus(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  // Export filtered contracts to CSV
  const exportContractsToCSV = () => {
    const headers = [
      'Contract Name',
      'Customer',
      'Customer Contact Email',
      'Project Type',
      'Lead(s)',
      'Team Members',
      'Contractual Hours/Week',
      'Start Date',
      'End Date',
      'Status'
    ];
    
    const rows = sortedProjects.map(project => {
      // Get lead names
      const projectLeadIds = project.leadIds && project.leadIds.length > 0 
        ? project.leadIds 
        : [project.leadId];
      const leadNames = projectLeadIds
        .map(leadId => projectLeads.find(l => l.id === leadId)?.name || 'Unknown')
        .join('; ');
      
      // Get team member names with roles
      const teamMembersList = (project.teamMembers as TeamMemberAssignment[] || [])
        .map(tm => {
          const member = teamMembers.find(m => m.id === tm.memberId);
          return member ? `${member.name} (${tm.role || 'No role'})` : '';
        })
        .filter(Boolean)
        .join('; ');
      
      // Get status
      const status = getProjectStatus(project.endDate);
      const statusLabel = status === 'active' ? 'Active' : status === 'renewal' ? 'Renewal Soon' : 'Ended';
      
      return [
        project.name,
        project.customer,
        project.customerContactEmail || '',
        project.projectType || '',
        leadNames,
        teamMembersList,
        project.totalContractualHours || '',
        project.startDate || '',
        project.endDate || '',
        statusLabel
      ];
    });
    
    // Create CSV content with proper escaping
    const escapeCSV = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };
    
    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');
    
    // Create and trigger download with robust mechanism
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Generate filename with filter info
    const filterCount = getActiveFilterCount();
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = filterCount > 0 
      ? `contracts_filtered_${dateStr}.csv`
      : `contracts_all_${dateStr}.csv`;
    
    // Create anchor element and trigger download
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    link.style.position = 'absolute';
    link.style.left = '-9999px';
    document.body.appendChild(link);
    
    // Use setTimeout to ensure the DOM has updated before clicking
    setTimeout(() => {
      link.click();
      // Clean up after a delay to ensure download starts
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    }, 0);
    
    toast({
      title: "Export Complete",
      description: `Exported ${sortedProjects.length} contract${sortedProjects.length !== 1 ? 's' : ''} to CSV`,
    });
  };

  const EndDateIndicator = ({ endDate }: { endDate: string | null | undefined }) => {
    const status = getProjectStatus(endDate);
    const isMissing = !endDate;
    
    if (isMissing) {
      return (
        <span title="Active but renewal soon (missing end date)">
          <AlertTriangle className="h-4 w-4 text-warning" />
        </span>
      );
    }
    if (status === 'ended') {
      return <span className="w-3 h-3 rounded-full bg-red-500 inline-block" title="Ended" />;
    }
    if (status === 'renewal') {
      return <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" title="Active but renewal soon" />;
    }
    return <span className="w-3 h-3 rounded-full bg-green-500 inline-block" title="Active with no renewal soon" />;
  };
  
  // Bulk selection helpers
  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };
  
  const toggleMemberSelection = (memberId: string) => {
    setSelectedMembers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  };
  
  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  };
  
  const selectAllProjects = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedProjects(new Set(sortedProjects.map(p => p.id)));
    } else {
      setSelectedProjects(new Set());
    }
  };
  
  const selectAllMembers = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedMembers(new Set(teamMembers.map(m => m.id)));
    } else {
      setSelectedMembers(new Set());
    }
  };
  
  const selectAllLeads = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedLeads(new Set(projectLeads.map(l => l.id)));
    } else {
      setSelectedLeads(new Set());
    }
  };

  const startEdit = (project: Project) => {
    setEditingProject(project);
    // Support both new leadIds array and legacy single leadId
    const leadIdsArray = project.leadIds && project.leadIds.length > 0 
      ? project.leadIds 
      : [project.leadId];
    const { hours, minutes } = parseContractualTime(project.totalContractualHours);
    setEditFormData({
      name: project.name,
      customer: project.customer,
      customerContactEmail: project.customerContactEmail || '',
      contractualHours: hours,
      contractualMinutes: minutes,
      leadIds: leadIdsArray,
      teamMembers: (project.teamMembers as TeamMemberAssignment[]) || [],
      startDate: project.startDate || '',
      endDate: project.endDate || '',
      projectType: project.projectType || '',
    });
    setEditStartDateInput(formatInputDate(project.startDate));
    setEditEndDateInput(formatInputDate(project.endDate));
    setSearchQuery('');
  };

  const editProjectMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<Project, 'id'>> }) => {
      return await apiRequest('PATCH', `/api/projects/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ 
        title: 'Success', 
        description: 'Project updated successfully' 
      });
      setEditingProject(null);
      setSearchQuery('');
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to update project',
        variant: 'destructive'
      });
    }
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ 
        title: 'Success', 
        description: 'Project deleted successfully' 
      });
      setDeletingProjectId(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete project',
        variant: 'destructive'
      });
    }
  });

  const handleSaveEdit = () => {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (editFormData.customerContactEmail && !emailRegex.test(editFormData.customerContactEmail.trim())) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid customer contact email address',
        variant: 'destructive',
      });
      return;
    }
    
    if (editingProject && editFormData.name && editFormData.customer && editFormData.customerContactEmail && 
        editFormData.leadIds.length > 0 && editFormData.teamMembers.length > 0 && editFormData.projectType) {
      
      // Validate date formats
      if (editStartDateInput && !isValidDateFormat(editStartDateInput)) {
        toast({
          title: 'Invalid Date',
          description: 'Start date must be in MM/DD/YYYY format',
          variant: 'destructive',
        });
        return;
      }
      if (editEndDateInput && !isValidDateFormat(editEndDateInput)) {
        toast({
          title: 'Invalid Date',
          description: 'End date must be in MM/DD/YYYY format',
          variant: 'destructive',
        });
        return;
      }
      
      // Validate start date is not in the future
      const startDateError = validateStartDate(editStartDateInput);
      if (startDateError) {
        toast({
          title: 'Invalid Date',
          description: startDateError,
          variant: 'destructive',
        });
        return;
      }
      
      // Validate end date is after start date and in the future
      const endDateError = validateEndDate(editStartDateInput, editEndDateInput);
      if (endDateError) {
        toast({
          title: 'Invalid Date',
          description: endDateError,
          variant: 'destructive',
        });
        return;
      }
      
      const startDateParsed = parseInputDate(editStartDateInput);
      const endDateParsed = parseInputDate(editEndDateInput);
      const totalMinutes = toTotalMinutes(editFormData.contractualHours, editFormData.contractualMinutes);
      
      editProjectMutation.mutate({ 
        id: editingProject.id, 
        updates: {
          name: editFormData.name,
          customer: editFormData.customer,
          customerContactEmail: editFormData.customerContactEmail,
          totalContractualHours: totalMinutes || null,
          leadId: editFormData.leadIds[0], // Primary lead is first in the array
          leadIds: editFormData.leadIds,
          teamMembers: editFormData.teamMembers,
          startDate: startDateParsed || '2025-08-30',
          endDate: endDateParsed || null,
          projectType: editFormData.projectType || null,
        }
      });
    }
  };

  // Toggle a team member in edit form - preserves existing roles
  const toggleTeamMember = (memberId: string) => {
    setEditFormData((prev) => {
      const existing = prev.teamMembers.find(m => m.memberId === memberId);
      if (existing) {
        // Remove member
        return { ...prev, teamMembers: prev.teamMembers.filter(m => m.memberId !== memberId) };
      } else {
        // Add member with empty role
        return { ...prev, teamMembers: [...prev.teamMembers, { memberId, role: '' }] };
      }
    });
  };

  // Update role for a team member in edit form
  const updateTeamMemberRole = (memberId: string, role: string) => {
    setEditFormData((prev) => ({
      ...prev,
      teamMembers: prev.teamMembers.map(m => 
        m.memberId === memberId ? { ...m, role } : m
      ),
    }));
  };

  // Note: filteredTeamMembers is defined later after getMemberRoles is available

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const response = await fetch('/api/jira/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectKey: jiraProjectKey || undefined }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Import failed');
      }

      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/team-members'] });
      queryClient.invalidateQueries({ queryKey: ['/api/project-leads'] });
      
      toast({ 
        title: 'Success', 
        description: 'Projects imported from Jira successfully' 
      });
      
      setShowImportDialog(false);
      setJiraProjectKey('');
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to import from Jira',
        variant: 'destructive'
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Team member mutations
  const createMemberMutation = useMutation({
    mutationFn: async ({ name, email }: { name: string; email?: string }) => {
      return await apiRequest('POST', '/api/team-members', { name, email });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-members'] });
      toast({ title: 'Success', description: 'Team member added' });
      setNewMember('');
      setNewMemberEmail('');
      setMemberNameError(null);
      setMemberNameWarning(null);
      setShowAddMemberDialog(false);
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to add team member',
        variant: 'destructive'
      });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async ({ id, name, email }: { id: string; name: string; email?: string }) => {
      return await apiRequest('PATCH', `/api/team-members/${id}`, { name, email });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-members'] });
      toast({ title: 'Success', description: 'Team member updated' });
      setEditingMemberId(null);
      setShowEditMemberDialog(false);
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to update team member',
        variant: 'destructive'
      });
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/team-members/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-members'] });
      toast({ title: 'Success', description: 'Team member deleted' });
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to delete team member',
        variant: 'destructive'
      });
    },
  });

  // Project lead mutations
  const createLeadMutation = useMutation({
    mutationFn: async ({ name, email }: { name: string; email?: string }) => {
      return await apiRequest('POST', '/api/project-leads', { name, email: email || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-leads'] });
      toast({ title: 'Success', description: 'Project lead added' });
      setNewLead('');
      setNewLeadEmail('');
      setLeadNameError(null);
      setLeadNameWarning(null);
      setShowAddLeadDialog(false);
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to add project lead',
        variant: 'destructive'
      });
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, name, email }: { id: string; name: string; email?: string }) => {
      return await apiRequest('PATCH', `/api/project-leads/${id}`, { name, email: email || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-leads'] });
      toast({ title: 'Success', description: 'Project lead updated' });
      setEditingLeadId(null);
      setShowEditLeadDialog(false);
      setEditLeadValue('');
      setEditLeadEmailValue('');
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to update project lead',
        variant: 'destructive'
      });
    },
  });

  const deleteLeadMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/project-leads/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-leads'] });
      toast({ title: 'Success', description: 'Project lead deleted' });
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to delete project lead',
        variant: 'destructive'
      });
    },
  });

  // Anonymous feedback submission mutations - appends feedback
  const submitLeadFeedbackMutation = useMutation({
    mutationFn: async ({ id, feedback }: { id: string; feedback: string }) => {
      return await apiRequest('POST', `/api/people/${id}/feedback`, { feedback });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/people/feedback'] });
      toast({ title: 'Feedback Submitted', description: 'Your anonymous feedback has been recorded' });
      setLeadFeedbackValue('');
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to submit feedback',
        variant: 'destructive'
      });
    },
  });

  const submitMemberFeedbackMutation = useMutation({
    mutationFn: async ({ id, feedback }: { id: string; feedback: string }) => {
      return await apiRequest('POST', `/api/people/${id}/feedback`, { feedback });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-members'] });
      queryClient.invalidateQueries({ queryKey: ['/api/people/feedback'] });
      toast({ title: 'Feedback Submitted', description: 'Your anonymous feedback has been recorded' });
      setMemberFeedbackValue('');
    },
    onError: () => {
      toast({ 
        title: 'Error', 
        description: 'Failed to submit feedback',
        variant: 'destructive'
      });
    },
  });

  // Project mutations
  const createProjectMutation = useMutation({
    mutationFn: async (project: InsertProject) => {
      return await apiRequest('POST', '/api/projects', project);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ 
        title: 'Success', 
        description: 'Project created successfully' 
      });
      setProjectFormData({
        name: '',
        customer: '',
        customerContactEmail: '',
        contractualHours: '',
        contractualMinutes: '',
        leadIds: [],
        teamMembers: [],
        startDate: '',
        endDate: '',
        projectType: '',
      });
      setProjectStartDateInput('');
      setProjectEndDateInput('');
      setProjectSearchQuery('');
      setProjectFormErrors({});
      setProjectNameError(null);
      setProjectNameWarning(null);
      setShowAddProjectDialog(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to create project',
        variant: 'destructive'
      });
    }
  });

  // Role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest('POST', '/api/project-roles', { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-roles'] });
      toast({ 
        title: 'Success', 
        description: 'Role added successfully' 
      });
      if (showAddRolePopover) {
        setRoleInputs(prev => ({ ...prev, [showAddRolePopover]: '' }));
      }
      setShowAddRolePopover(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to add role',
        variant: 'destructive'
      });
    }
  });

  // Seed default roles on component mount if none exist
  const seedRolesMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', '/api/project-roles/seed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-roles'] });
    },
  });

  useEffect(() => {
    if (projectRoles.length === 0 && !hasAttemptedSeed.current) {
      hasAttemptedSeed.current = true;
      seedRolesMutation.mutate();
    }
  }, [projectRoles.length]);

  const startEditMember = (member: TeamMember) => {
    setEditingMemberId(member.id);
    setEditMemberValue(member.name);
    // Strip the domain when loading for editing
    const emailUsername = member.email ? member.email.replace(/@ignitetech\.com$/, '') : '';
    setEditMemberEmailValue(emailUsername);
    setShowEditMemberDialog(true);
  };

  const startEditLead = (lead: ProjectLead) => {
    setEditingLeadId(lead.id);
    setEditLeadValue(lead.name);
    // Strip the domain when loading for editing
    const emailUsername = lead.email ? lead.email.replace(/@ignitetech\.com$/, '') : '';
    setEditLeadEmailValue(emailUsername);
    setShowEditLeadDialog(true);
  };

  const saveEditMember = () => {
    if (editingMemberId && editMemberValue.trim()) {
      const email = editMemberEmailValue.trim() ? `${editMemberEmailValue.trim()}@ignitetech.com` : undefined;
      updateMemberMutation.mutate({ 
        id: editingMemberId, 
        name: editMemberValue.trim(), 
        email
      });
    }
  };

  const cancelEditMember = () => {
    setShowEditMemberDialog(false);
    setEditingMemberId(null);
    setEditMemberValue('');
    setEditMemberEmailValue('');
  };

  const saveEditLead = () => {
    if (editingLeadId && editLeadValue.trim()) {
      const email = editLeadEmailValue.trim() ? `${editLeadEmailValue.trim()}@ignitetech.com` : undefined;
      updateLeadMutation.mutate({ 
        id: editingLeadId, 
        name: editLeadValue.trim(),
        email
      });
    }
  };

  const cancelEditLead = () => {
    setShowEditLeadDialog(false);
    setEditingLeadId(null);
    setEditLeadValue('');
    setEditLeadEmailValue('');
  };

  // Check for duplicate names in team members
  const checkMemberDuplicate = (name: string): { isExact: boolean; partialMatches: string[] } => {
    const trimmedName = name.trim().toLowerCase();
    const exactMatch = teamMembers.some(m => m.name.toLowerCase() === trimmedName);
    const partialMatches = teamMembers
      .filter(m => {
        const existingName = m.name.toLowerCase();
        return existingName !== trimmedName && (
          existingName.includes(trimmedName) || 
          trimmedName.includes(existingName) ||
          existingName.split(' ').some(part => trimmedName.split(' ').some(inputPart => 
            part.length > 2 && inputPart.length > 2 && (part.includes(inputPart) || inputPart.includes(part))
          ))
        );
      })
      .map(m => m.name);
    return { isExact: exactMatch, partialMatches };
  };

  // Check for duplicate names in project leads
  const checkLeadDuplicate = (name: string): { isExact: boolean; partialMatches: string[] } => {
    const trimmedName = name.trim().toLowerCase();
    const exactMatch = projectLeads.some(l => l.name.toLowerCase() === trimmedName);
    const partialMatches = projectLeads
      .filter(l => {
        const existingName = l.name.toLowerCase();
        return existingName !== trimmedName && (
          existingName.includes(trimmedName) || 
          trimmedName.includes(existingName) ||
          existingName.split(' ').some(part => trimmedName.split(' ').some(inputPart => 
            part.length > 2 && inputPart.length > 2 && (part.includes(inputPart) || inputPart.includes(part))
          ))
        );
      })
      .map(l => l.name);
    return { isExact: exactMatch, partialMatches };
  };

  // Handle member name change with validation
  const handleMemberNameChange = (value: string) => {
    setNewMember(value);
    if (!value.trim()) {
      setMemberNameError(null);
      setMemberNameWarning(null);
      return;
    }
    const { isExact, partialMatches } = checkMemberDuplicate(value);
    if (isExact) {
      setMemberNameError('A team member with this exact name already exists.');
      setMemberNameWarning(null);
    } else if (partialMatches.length > 0) {
      setMemberNameError(null);
      setMemberNameWarning(`Similar name(s) found: ${partialMatches.join(', ')}. Please double check before adding.`);
    } else {
      setMemberNameError(null);
      setMemberNameWarning(null);
    }
  };

  // Handle lead name change with validation
  const handleLeadNameChange = (value: string) => {
    setNewLead(value);
    if (!value.trim()) {
      setLeadNameError(null);
      setLeadNameWarning(null);
      return;
    }
    const { isExact, partialMatches } = checkLeadDuplicate(value);
    if (isExact) {
      setLeadNameError('A project lead with this exact name already exists.');
      setLeadNameWarning(null);
    } else if (partialMatches.length > 0) {
      setLeadNameError(null);
      setLeadNameWarning(`Similar name(s) found: ${partialMatches.join(', ')}. Please double check before adding.`);
    } else {
      setLeadNameError(null);
      setLeadNameWarning(null);
    }
  };

  const handleAddMember = () => {
    if (newMember.trim() && !memberNameError) {
      const email = newMemberEmail.trim() ? `${newMemberEmail.trim()}@ignitetech.com` : undefined;
      createMemberMutation.mutate({ name: newMember.trim(), email });
    }
  };

  const handleAddLead = () => {
    if (newLead.trim() && !leadNameError) {
      const email = newLeadEmail.trim() ? `${newLeadEmail.trim()}@ignitetech.com` : undefined;
      createLeadMutation.mutate({ name: newLead.trim(), email });
    }
  };

  // Check for duplicate project names
  const checkProjectDuplicate = (name: string): { isExact: boolean; partialMatches: string[] } => {
    const trimmedName = name.trim().toLowerCase();
    const exactMatch = projects.some(p => p.name.toLowerCase() === trimmedName);
    const partialMatches = projects
      .filter(p => {
        const existingName = p.name.toLowerCase();
        return existingName !== trimmedName && (
          existingName.includes(trimmedName) || 
          trimmedName.includes(existingName) ||
          existingName.split(' ').some(part => trimmedName.split(' ').some(inputPart => 
            part.length > 2 && inputPart.length > 2 && (part.includes(inputPart) || inputPart.includes(part))
          ))
        );
      })
      .map(p => p.name);
    return { isExact: exactMatch, partialMatches };
  };

  // Handle project name change with validation
  const handleProjectNameChange = (value: string) => {
    setProjectFormData(prev => ({ ...prev, name: value }));
    if (!value.trim()) {
      setProjectNameError(null);
      setProjectNameWarning(null);
      return;
    }
    const { isExact, partialMatches } = checkProjectDuplicate(value);
    if (isExact) {
      setProjectNameError('A project with this exact name already exists.');
      setProjectNameWarning(null);
    } else if (partialMatches.length > 0) {
      setProjectNameError(null);
      setProjectNameWarning(`Similar project(s) found: ${partialMatches.join(', ')}. Please double check before adding.`);
    } else {
      setProjectNameError(null);
      setProjectNameWarning(null);
    }
  };

  // Handle lead tile click to show detail popup
  const handleLeadTileClick = (lead: Person) => {
    if (!selectionModeLeads) {
      setSelectedLeadForDetail(lead);
      setLeadFeedbackValue('');
      setShowLeadDetailModal(true);
    }
  };

  const closeLeadDetailModal = () => {
    setShowLeadDetailModal(false);
    setSelectedLeadForDetail(null);
    setLeadFeedbackValue('');
    setShowAllLeadContracts(false);
  };

  // Handle team member tile click to show detail popup
  const handleMemberTileClick = (member: Person) => {
    if (!selectionModeMembers) {
      setSelectedMemberForDetail(member);
      setMemberFeedbackValue('');
      setShowMemberDetailModal(true);
    }
  };

  const closeMemberDetailModal = () => {
    setShowMemberDetailModal(false);
    setSelectedMemberForDetail(null);
    setMemberFeedbackValue('');
    setShowAllMemberContracts(false);
  };

  // Get projects a team member is working on with their roles
  const getMemberProjects = (memberId: string) => {
    return projects.filter(p => {
      const assignments = (p.teamMembers as TeamMemberAssignment[]) || [];
      return assignments.some(a => a.memberId === memberId);
    }).map(p => {
      const assignments = (p.teamMembers as TeamMemberAssignment[]) || [];
      const assignment = assignments.find(a => a.memberId === memberId);
      return {
        project: p,
        role: assignment?.role || 'No role assigned'
      };
    });
  };

  // Get all unique roles from all projects (only from active/renewal projects)
  const getAllUniqueRoles = (): string[] => {
    const rolesSet = new Set<string>();
    projects.forEach(p => {
      const status = getProjectStatus(p.endDate);
      if (status === 'active' || status === 'renewal') {
        const assignments = (p.teamMembers as TeamMemberAssignment[]) || [];
        assignments.forEach(a => {
          if (a.role && a.role.trim()) {
            rolesSet.add(a.role.trim());
          }
        });
      }
    });
    return Array.from(rolesSet).sort();
  };

  // Get roles for a specific team member (from active/renewal projects)
  const getMemberRoles = (memberId: string): string[] => {
    const rolesSet = new Set<string>();
    projects.forEach(p => {
      const status = getProjectStatus(p.endDate);
      if (status === 'active' || status === 'renewal') {
        const assignments = (p.teamMembers as TeamMemberAssignment[]) || [];
        const assignment = assignments.find(a => a.memberId === memberId);
        if (assignment?.role && assignment.role.trim()) {
          rolesSet.add(assignment.role.trim());
        }
      }
    });
    return Array.from(rolesSet);
  };

  // Filter team members by search query and selected roles
  const filteredTeamMembers = teamMembers
    .filter((member) => member.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(member => {
      if (filterMemberRoles.length === 0) return true;
      const memberRoles = getMemberRoles(member.id);
      return filterMemberRoles.some(role => memberRoles.includes(role));
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const toggleMemberRoleFilter = (role: string) => {
    setFilterMemberRoles(prev => 
      prev.includes(role) 
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const clearMemberRoleFilters = () => {
    setFilterMemberRoles([]);
    setMemberRoleSearchQuery('');
  };

  const validateProjectForm = () => {
    const errors: Record<string, string> = {};
    if (!projectFormData.name.trim()) {
      errors.name = 'Project customer is required';
    } else if (projectNameError) {
      errors.name = projectNameError;
    }
    if (!projectFormData.customer.trim()) {
      errors.customer = 'Contact person name is required';
    }
    if (!projectFormData.customerContactEmail.trim()) {
      errors.customerContactEmail = 'Customer contact email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(projectFormData.customerContactEmail.trim())) {
      errors.customerContactEmail = 'Please enter a valid email address';
    }
    if (projectFormData.leadIds.length === 0) {
      errors.leadIds = 'At least one project lead is required';
    }
    if (projectFormData.teamMembers.length === 0) {
      errors.teamMembers = 'At least one team member is required';
    }
    if (!projectFormData.projectType) {
      errors.projectType = 'Project type is required';
    }
    return errors;
  };

  const handleSubmitProject = (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateProjectForm();
    
    // Validate date formats
    if (projectStartDateInput && !isValidDateFormat(projectStartDateInput)) {
      errors.startDate = 'Invalid date format. Use MM/DD/YYYY';
    }
    if (projectEndDateInput && !isValidDateFormat(projectEndDateInput)) {
      errors.endDate = 'Invalid date format. Use MM/DD/YYYY';
    }
    
    // Validate start date is not in the future
    const startDateError = validateStartDate(projectStartDateInput);
    if (startDateError) {
      errors.startDate = startDateError;
    }
    
    // Validate end date is after start date and in the future
    const endDateError = validateEndDate(projectStartDateInput, projectEndDateInput);
    if (endDateError) {
      errors.endDate = endDateError;
    }
    
    setProjectFormErrors(errors);
    
    if (Object.keys(errors).length === 0) {
      const startDateParsed = parseInputDate(projectStartDateInput);
      const endDateParsed = parseInputDate(projectEndDateInput);
      const totalMinutes = toTotalMinutes(projectFormData.contractualHours, projectFormData.contractualMinutes);
      
      createProjectMutation.mutate({
        name: projectFormData.name,
        customer: projectFormData.customer,
        customerContactEmail: projectFormData.customerContactEmail,
        totalContractualHours: totalMinutes || null,
        leadId: projectFormData.leadIds[0], // Primary lead is first in the array
        leadIds: projectFormData.leadIds,
        teamMembers: projectFormData.teamMembers,
        startDate: startDateParsed || '2025-08-30',
        endDate: endDateParsed || null,
        projectType: projectFormData.projectType || null,
      });
    } else {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields correctly',
        variant: 'destructive',
      });
    }
  };

  // Toggle a team member in add project form
  const toggleProjectTeamMember = (memberId: string) => {
    setProjectFormData((prev) => {
      const existing = prev.teamMembers.find(m => m.memberId === memberId);
      if (existing) {
        return { ...prev, teamMembers: prev.teamMembers.filter(m => m.memberId !== memberId) };
      } else {
        return { ...prev, teamMembers: [...prev.teamMembers, { memberId, role: '' }] };
      }
    });
  };

  // Update role for a team member in add project form
  const updateProjectTeamMemberRole = (memberId: string, role: string) => {
    setProjectFormData((prev) => ({
      ...prev,
      teamMembers: prev.teamMembers.map(m => 
        m.memberId === memberId ? { ...m, role } : m
      ),
    }));
  };

  const filteredProjectTeamMembers = teamMembers
    .filter((member) => member.name.toLowerCase().includes(projectSearchQuery.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  const getActiveFilterCount = () => {
    let count = 0;
    if (filterProjectName) count++;
    if (filterLeads.length > 0) count += filterLeads.length;
    if (filterMembers.length > 0) count += filterMembers.length;
    if (filterProjectStatus.length > 0) count += filterProjectStatus.length;
    if (filterProjectsWithCaution) count++;
    if (filterEndDateAfter) count++;
    return count;
  };

  const clearAllFilters = () => {
    setFilterProjectName('');
    setFilterLeads([]);
    setFilterMembers([]);
    setFilterMemberSearch('');
    setFilterLeadSearch('');
    setFilterProjectStatus([]);
    setFilterProjectsWithCaution(false);
    setFilterEndDateAfter('');
  };
  
  // Exit selection mode and clear selections
  const exitSelectionModeProjects = () => {
    setSelectionModeProjects(false);
    setSelectedProjects(new Set());
  };
  
  const exitSelectionModeMembers = () => {
    setSelectionModeMembers(false);
    setSelectedMembers(new Set());
  };
  
  const exitSelectionModeLeads = () => {
    setSelectionModeLeads(false);
    setSelectedLeads(new Set());
  };
  
  // Bulk delete mutations
  const bulkDeleteProjectsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => apiRequest('DELETE', `/api/projects/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ 
        title: 'Success', 
        description: `${selectedProjects.size} project(s) deleted successfully` 
      });
      setSelectedProjects(new Set());
      setShowBulkDeleteProjects(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete projects',
        variant: 'destructive'
      });
    }
  });
  
  const bulkDeleteMembersMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => apiRequest('DELETE', `/api/team-members/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/team-members'] });
      toast({ 
        title: 'Success', 
        description: `${selectedMembers.size} team member(s) deleted successfully` 
      });
      setSelectedMembers(new Set());
      setShowBulkDeleteMembers(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete team members',
        variant: 'destructive'
      });
    }
  });
  
  const bulkDeleteLeadsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => apiRequest('DELETE', `/api/project-leads/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/project-leads'] });
      toast({ 
        title: 'Success', 
        description: `${selectedLeads.size} project lead(s) deleted successfully` 
      });
      setSelectedLeads(new Set());
      setShowBulkDeleteLeads(false);
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete project leads',
        variant: 'destructive'
      });
    }
  });

  // Long-term active projects = green status (active with no renewal soon)
  const longTermActiveProjects = projects.filter(p => getProjectStatus(p.endDate) === 'active');
  const longTermActiveCMS = longTermActiveProjects.filter(p => p.projectType === 'CMS').length;
  const longTermActiveSS = longTermActiveProjects.filter(p => p.projectType === 'SS').length;
  
  const renewalProjects = projects.filter(p => getProjectStatus(p.endDate) === 'renewal');
  const renewalProjectsCMS = renewalProjects.filter(p => p.projectType === 'CMS').length;
  const renewalProjectsSS = renewalProjects.filter(p => p.projectType === 'SS').length;

  // All active contracts (not ended) = long-term active + renewal
  const allActiveContracts = projects.filter(p => getProjectStatus(p.endDate) !== 'ended');

  // Tile click handlers - clear all filters first, then apply specific filter and scroll
  // If clicking the same tile that's already filtered, toggle it off (clear all filters)
  const handleLongTermActiveClick = () => {
    // Clear all existing filters
    setFilterLeads([]);
    setFilterMembers([]);
    setFilterProjectName('');
    setFilterProjectsWithCaution(false);
    
    // Toggle: if already filtered to 'active', clear it; otherwise apply it
    if (filterProjectStatus.includes('active') && filterProjectStatus.length === 1) {
      setFilterProjectStatus([]);
    } else {
      setFilterProjectStatus(['active']);
    }
    
    setTimeout(() => {
      const projectsSection = document.getElementById('all-projects-section');
      if (projectsSection) {
        projectsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleRenewalsSoonClick = () => {
    // Clear all existing filters
    setFilterLeads([]);
    setFilterMembers([]);
    setFilterProjectName('');
    setFilterProjectsWithCaution(false);
    
    // Toggle: if already filtered to 'renewal', clear it; otherwise apply it
    if (filterProjectStatus.includes('renewal') && filterProjectStatus.length === 1) {
      setFilterProjectStatus([]);
    } else {
      setFilterProjectStatus(['renewal']);
    }
    
    setTimeout(() => {
      const projectsSection = document.getElementById('all-projects-section');
      if (projectsSection) {
        projectsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <div className="space-y-8">
      {/* Caution banner for leads not registered - only show if user role is 'lead' */}
      {user && permissions.role === 'lead' && !isUserRegisteredLead && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-start gap-3" data-testid="banner-unregistered-lead">
          <AlertTriangle className="h-6 w-6 text-warning flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-warning">SS/CMS Lead: Register Your Email</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your email (<span className="font-medium">{user.email}</span>) is not linked to any SS/CMS Lead profile. 
              Please find your name in the <span className="font-medium">Team Leads</span> section below and add your email to your profile.
            </p>
          </div>
        </div>
      )}

      {/* Caution banner for members not registered - only show if user role is 'member' */}
      {user && permissions.role === 'member' && !isUserRegisteredTeamMember && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-start gap-3" data-testid="banner-unregistered-member">
          <AlertTriangle className="h-6 w-6 text-warning flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-warning">SS/CMS Team Member: Register Your Email</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your email (<span className="font-medium">{user.email}</span>) is not linked to any SS/CMS Team Member profile. 
              Please find your name in the <span className="font-medium">Team Members</span> section below and add your email to your profile.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div 
          className="metric-card metric-card-success cursor-pointer hover:border-success/30 transition-all"
          onClick={handleLongTermActiveClick}
          data-testid="tile-long-term-active"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="section-label">Long-term Active Contracts</p>
              <p className="text-sm text-muted-foreground mb-2">CMS | SS</p>
              <p className="text-4xl font-bold tabular-nums text-success" data-testid="text-long-term-active">
                {longTermActiveProjects.length} <span className="text-xl font-normal text-muted-foreground">({longTermActiveCMS} | {longTermActiveSS})</span>
              </p>
            </div>
            <div className="p-3 rounded-xl bg-success/10 border border-success/20">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
          </div>
        </div>

        <div 
          className="metric-card metric-card-warning cursor-pointer hover:border-warning/30 transition-all"
          onClick={handleRenewalsSoonClick}
          data-testid="tile-renewals-soon"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="section-label">Contracts with renewals &lt; 2 months</p>
              <p className="text-sm text-muted-foreground mb-2">CMS | SS</p>
              <p className="text-4xl font-bold tabular-nums text-warning" data-testid="text-renewals-soon">
                {renewalProjects.length} <span className="text-xl font-normal text-muted-foreground">({renewalProjectsCMS} | {renewalProjectsSS})</span>
              </p>
            </div>
            <div className="p-3 rounded-xl bg-warning/10 border border-warning/20">
              <AlertCircle className="h-8 w-8 text-warning" />
            </div>
          </div>
        </div>
      </div>

      {/* All Projects Section */}
      <Card id="all-projects-section" className="glass-card border-white/10">
        <CardHeader className="border-b border-white/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div 
              className="cursor-pointer" 
              onClick={() => {
                // Clear all filters when clicking "All Contracts"
                setFilterLeads([]);
                setFilterMembers([]);
                setFilterProjectName('');
                setFilterProjectStatus([]);
                setFilterProjectsWithCaution(false);
              }}
              data-testid="button-all-contracts"
            >
              <p className="section-label">Contract Portfolio</p>
              <CardTitle className="text-2xl hover:text-primary transition-colors">All Contracts <span className="text-primary">({allActiveContracts.length} Active)</span></CardTitle>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
              {/* Add New Project Button - requires canAddContracts permission */}
              {permissions.canAddContracts && (
              <Dialog open={showAddProjectDialog} onOpenChange={(open) => {
                setShowAddProjectDialog(open);
                if (!open) {
                  setProjectFormData({
                    name: '',
                    customer: '',
                    customerContactEmail: '',
                    contractualHours: '',
                    contractualMinutes: '',
                    leadIds: [],
                    teamMembers: [],
                    startDate: '',
                    endDate: '',
                    projectType: '',
                  });
                  setProjectStartDateInput('');
                  setProjectEndDateInput('');
                  setProjectSearchQuery('');
                  setProjectFormErrors({});
                  setProjectNameError(null);
                  setProjectNameWarning(null);
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="default" className="gap-2" data-testid="button-add-project">
                    <Plus className="h-4 w-4" />
                    Add New Contract
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add New Contract</DialogTitle>
                    <DialogDescription>
                      Create a new contract with team member(s) and team lead(s).
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmitProject} className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-project-name">Account Name <span className="text-red-500">*</span></Label>
                      <Input
                        id="new-project-name"
                        data-testid="input-project-name"
                        type="text"
                        value={projectFormData.name}
                        onChange={(e) => {
                          handleProjectNameChange(e.target.value);
                          if (projectFormErrors.name) {
                            setProjectFormErrors({ ...projectFormErrors, name: '' });
                          }
                        }}
                        placeholder="Enter account name"
                        className={(projectFormErrors.name || projectNameError) ? 'border-red-500' : projectNameWarning ? 'border-yellow-500' : ''}
                      />
                      {projectFormErrors.name && (
                        <p className="text-sm text-red-500" data-testid="error-project-name">{projectFormErrors.name}</p>
                      )}
                      {projectNameError && !projectFormErrors.name && (
                        <p className="text-sm text-red-500 flex items-center gap-1" data-testid="error-project-name-duplicate">
                          <AlertCircle className="h-3 w-3" /> {projectNameError}
                        </p>
                      )}
                      {projectNameWarning && !projectNameError && (
                        <p className="text-sm text-yellow-600 flex items-center gap-1" data-testid="warning-project-name">
                          <AlertTriangle className="h-3 w-3" /> {projectNameWarning}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-customer">Customer Contact Name <span className="text-red-500">*</span></Label>
                      <Input
                        id="new-customer"
                        data-testid="input-customer"
                        type="text"
                        value={projectFormData.customer}
                        onChange={(e) => {
                          setProjectFormData({ ...projectFormData, customer: e.target.value });
                          if (projectFormErrors.customer) {
                            setProjectFormErrors({ ...projectFormErrors, customer: '' });
                          }
                        }}
                        placeholder="Enter customer contact name"
                        className={projectFormErrors.customer ? 'border-red-500' : ''}
                      />
                      {projectFormErrors.customer && (
                        <p className="text-sm text-red-500" data-testid="error-customer">{projectFormErrors.customer}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-customer-email">Customer Contact Email <span className="text-red-500">*</span></Label>
                      <Input
                        id="new-customer-email"
                        data-testid="input-customer-email"
                        type="email"
                        value={projectFormData.customerContactEmail}
                        onChange={(e) => {
                          setProjectFormData({ ...projectFormData, customerContactEmail: e.target.value });
                          if (projectFormErrors.customerContactEmail) {
                            setProjectFormErrors({ ...projectFormErrors, customerContactEmail: '' });
                          }
                        }}
                        placeholder="Enter customer contact email"
                        className={projectFormErrors.customerContactEmail ? 'border-red-500' : ''}
                      />
                      {projectFormErrors.customerContactEmail && (
                        <p className="text-sm text-red-500" data-testid="error-customer-email">{projectFormErrors.customerContactEmail}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Total Contractual Time</Label>
                      <div className="flex gap-2 items-center">
                        <div className="flex-1">
                          <Input
                            id="new-contractual-hours"
                            data-testid="input-contractual-hours"
                            type="text"
                            value={projectFormData.contractualHours}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, '');
                              setProjectFormData({ ...projectFormData, contractualHours: value });
                            }}
                            placeholder="Hours"
                          />
                        </div>
                        <span className="text-muted-foreground text-sm">hrs</span>
                        <div className="flex-1">
                          <Input
                            id="new-contractual-minutes"
                            data-testid="input-contractual-minutes"
                            type="text"
                            value={projectFormData.contractualMinutes}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, '');
                              const numVal = parseInt(value, 10);
                              if (value === '' || (numVal >= 0 && numVal <= 59)) {
                                setProjectFormData({ ...projectFormData, contractualMinutes: value });
                              }
                            }}
                            placeholder="Minutes"
                          />
                        </div>
                        <span className="text-muted-foreground text-sm">min</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Team Lead(s) <span className="text-red-500">*</span></Label>
                        {projectFormData.leadIds.length > 0 && (
                          <Badge variant="secondary" data-testid="badge-lead-count">
                            {projectFormData.leadIds.length} selected {projectFormData.leadIds.length === 2 && '(Co-leads)'}
                          </Badge>
                        )}
                      </div>
                      <div className={`border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto ${projectFormErrors.leadIds ? 'border-red-500' : ''}`} data-testid="leads-selection-container">
                        {[...projectLeads].sort((a, b) => a.name.localeCompare(b.name)).map((lead) => {
                          const isSelected = projectFormData.leadIds.includes(lead.id);
                          return (
                            <div key={lead.id} className="flex items-center gap-2">
                              <Checkbox
                                id={`new-lead-${lead.id}`}
                                data-testid={`checkbox-lead-${lead.id}`}
                                checked={isSelected}
                                onCheckedChange={() => {
                                  const newLeadIds = isSelected
                                    ? projectFormData.leadIds.filter(id => id !== lead.id)
                                    : [...projectFormData.leadIds, lead.id];
                                  setProjectFormData({ ...projectFormData, leadIds: newLeadIds });
                                  if (projectFormErrors.leadIds) {
                                    setProjectFormErrors({ ...projectFormErrors, leadIds: '' });
                                  }
                                }}
                              />
                              <Label
                                htmlFor={`new-lead-${lead.id}`}
                                className="font-normal text-sm cursor-pointer flex-1"
                              >
                                {lead.name}
                                {projectFormData.leadIds.indexOf(lead.id) === 0 && projectFormData.leadIds.length > 1 && (
                                  <span className="text-xs text-muted-foreground ml-2">(Primary)</span>
                                )}
                              </Label>
                            </div>
                          );
                        })}
                        {projectLeads.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-2">No project leads available</p>
                        )}
                      </div>
                      {projectFormErrors.leadIds && (
                        <p className="text-sm text-red-500" data-testid="error-lead">{projectFormErrors.leadIds}</p>
                      )}
                      <p className="text-xs text-muted-foreground">Select one lead, or select two for co-lead. First selected becomes primary.</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Team Members <span className="text-red-500">*</span></Label>
                        {projectFormData.teamMembers.length > 0 && (
                          <Badge variant="secondary" data-testid="badge-selected-count">
                            {projectFormData.teamMembers.length} selected
                          </Badge>
                        )}
                      </div>
                      
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Search team members..."
                          value={projectSearchQuery}
                          onChange={(e) => setProjectSearchQuery(e.target.value)}
                          className="pl-9 pr-9"
                          data-testid="input-search-members"
                        />
                        {projectSearchQuery && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setProjectSearchQuery('')}
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                            data-testid="button-clear-search"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className={`border rounded-md p-4 space-y-2 max-h-64 overflow-y-auto ${projectFormErrors.teamMembers ? 'border-red-500' : ''}`}>
                        {filteredProjectTeamMembers.length > 0 ? (
                          filteredProjectTeamMembers.map((member) => {
                            const assignment = projectFormData.teamMembers.find(m => m.memberId === member.id);
                            const isSelected = !!assignment;
                            return (
                              <div key={member.id} className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    id={`new-member-${member.id}`}
                                    data-testid={`checkbox-member-${member.id}`}
                                    checked={isSelected}
                                    onCheckedChange={() => {
                                      toggleProjectTeamMember(member.id);
                                      if (projectFormErrors.teamMembers) {
                                        setProjectFormErrors({ ...projectFormErrors, teamMembers: '' });
                                      }
                                    }}
                                  />
                                  <Label htmlFor={`new-member-${member.id}`} className="font-normal cursor-pointer flex-1">
                                    {member.name}
                                  </Label>
                                </div>
                                {isSelected && (
                                  <div className="ml-6 flex items-center gap-2">
                                    <Select
                                      value={assignment?.role || ''}
                                      onValueChange={(value) => {
                                        if (value === '__add_new__') {
                                          setShowAddRolePopover(`add-${member.id}`);
                                        } else {
                                          updateProjectTeamMemberRole(member.id, value);
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-sm" data-testid={`select-role-${member.id}`}>
                                        <SelectValue placeholder="Select role..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {projectRoles.map((role) => (
                                          <SelectItem key={role.id} value={role.name}>
                                            {role.name}
                                          </SelectItem>
                                        ))}
                                        <SelectItem value="__add_new__" className="text-primary font-medium">
                                          <span className="flex items-center gap-1">
                                            <Plus className="h-3 w-3" /> Add New Role
                                          </span>
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                    {showAddRolePopover === `add-${member.id}` && (
                                      <Popover open={true} onOpenChange={() => setShowAddRolePopover(null)}>
                                        <PopoverTrigger asChild>
                                          <span />
                                        </PopoverTrigger>
                                        <PopoverContent className="w-64" align="start">
                                          <div className="space-y-2">
                                            <Label>New Role Name</Label>
                                            <Input
                                              type="text"
                                              placeholder="Enter role name..."
                                              value={roleInputs[`add-${member.id}`] || ''}
                                              onChange={(e) => setRoleInputs(prev => ({ ...prev, [`add-${member.id}`]: e.target.value }))}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter' && (roleInputs[`add-${member.id}`] || '').trim()) {
                                                  createRoleMutation.mutate((roleInputs[`add-${member.id}`] || '').trim());
                                                }
                                              }}
                                              data-testid={`input-new-role-${member.id}`}
                                            />
                                            <div className="flex gap-2 justify-end">
                                              <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                  setShowAddRolePopover(null);
                                                  setRoleInputs(prev => ({ ...prev, [`add-${member.id}`]: '' }));
                                                }}
                                              >
                                                Cancel
                                              </Button>
                                              <Button
                                                size="sm"
                                                onClick={() => {
                                                  if ((roleInputs[`add-${member.id}`] || '').trim()) {
                                                    createRoleMutation.mutate((roleInputs[`add-${member.id}`] || '').trim());
                                                  }
                                                }}
                                                disabled={!(roleInputs[`add-${member.id}`] || '').trim() || createRoleMutation.isPending}
                                                data-testid={`button-save-role-${member.id}`}
                                              >
                                                {createRoleMutation.isPending ? 'Adding...' : 'Add'}
                                              </Button>
                                            </div>
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-results">
                            No team members found matching "{projectSearchQuery}"
                          </p>
                        )}
                      </div>
                      {projectFormErrors.teamMembers && (
                        <p className="text-sm text-red-500" data-testid="error-team-members">{projectFormErrors.teamMembers}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="new-start-date">Start Date</Label>
                        <Input
                          id="new-start-date"
                          data-testid="input-start-date"
                          type="text"
                          placeholder="MM/DD/YYYY"
                          value={projectStartDateInput}
                          onChange={(e) => setProjectStartDateInput(formatDateInput(e.target.value))}
                          className={(!isValidDateFormat(projectStartDateInput) && projectStartDateInput) || validateStartDate(projectStartDateInput) ? 'border-red-500' : ''}
                        />
                        {!isValidDateFormat(projectStartDateInput) && projectStartDateInput && (
                          <p className="text-xs text-red-500">Enter a valid date</p>
                        )}
                        {isValidDateFormat(projectStartDateInput) && validateStartDate(projectStartDateInput) && (
                          <p className="text-xs text-red-500">{validateStartDate(projectStartDateInput)}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-end-date">End Date</Label>
                        <Input
                          id="new-end-date"
                          data-testid="input-end-date"
                          type="text"
                          placeholder="MM/DD/YYYY"
                          value={projectEndDateInput}
                          onChange={(e) => setProjectEndDateInput(formatDateInput(e.target.value))}
                          className={(!isValidDateFormat(projectEndDateInput) && projectEndDateInput) || validateEndDate(projectStartDateInput, projectEndDateInput) ? 'border-red-500' : ''}
                        />
                        {!isValidDateFormat(projectEndDateInput) && projectEndDateInput && (
                          <p className="text-xs text-red-500">Enter a valid date</p>
                        )}
                        {isValidDateFormat(projectEndDateInput) && validateEndDate(projectStartDateInput, projectEndDateInput) && (
                          <p className="text-xs text-red-500">{validateEndDate(projectStartDateInput, projectEndDateInput)}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Contract Business Nature <span className="text-red-500">*</span></Label>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="project-type-cms"
                            data-testid="checkbox-project-type-cms"
                            checked={projectFormData.projectType === 'CMS'}
                            onCheckedChange={(checked) => {
                              setProjectFormData({ 
                                ...projectFormData, 
                                projectType: checked ? 'CMS' : '' 
                              });
                            }}
                          />
                          <Label htmlFor="project-type-cms" className="font-normal cursor-pointer">
                            Community Managed Services (CMS)
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="project-type-ss"
                            data-testid="checkbox-project-type-ss"
                            checked={projectFormData.projectType === 'SS'}
                            onCheckedChange={(checked) => {
                              setProjectFormData({ 
                                ...projectFormData, 
                                projectType: checked ? 'SS' : '' 
                              });
                            }}
                          />
                          <Label htmlFor="project-type-ss" className="font-normal cursor-pointer">
                            Strategic Services (SS)
                          </Label>
                        </div>
                      </div>
                      {projectFormErrors.projectType && (
                        <p className="text-xs text-red-500">{projectFormErrors.projectType}</p>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowAddProjectDialog(false)}
                        data-testid="button-cancel-add-project"
                      >
                        Cancel
                      </Button>
                      <Button 
                        data-testid="button-submit-project" 
                        type="submit"
                        disabled={createProjectMutation.isPending}
                      >
                        {createProjectMutation.isPending ? 'Adding...' : 'Add Project'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
              )}

              {permissions.canDeleteContracts && (
              <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2" data-testid="button-import-jira" disabled>
                    <Download className="h-4 w-4" />
                    Import from Jira
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Import Projects from Jira</DialogTitle>
                    <DialogDescription>
                      Import epics from Jira as projects. Leave project key empty to import all epics.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="jira-project-key">Jira Project Key (Optional)</Label>
                      <Input
                        id="jira-project-key"
                        data-testid="input-jira-project-key"
                        placeholder="e.g., PROJ"
                        value={jiraProjectKey}
                        onChange={(e) => setJiraProjectKey(e.target.value.toUpperCase())}
                      />
                      <p className="text-sm text-muted-foreground">
                        Leave empty to import all epics from all projects
                      </p>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowImportDialog(false);
                          setJiraProjectKey('');
                        }}
                        disabled={isImporting}
                        data-testid="button-cancel-import"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleImport}
                        disabled={isImporting}
                        data-testid="button-confirm-import"
                      >
                        {isImporting ? 'Importing...' : 'Import'}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              )}

              {/* Export CSV Button */}
              <Button
                variant="outline"
                className="gap-2"
                onClick={exportContractsToCSV}
                data-testid="button-export-contracts"
              >
                <Download className="h-4 w-4" />
                Export CSV
                {getActiveFilterCount() > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {sortedProjects.length}
                  </Badge>
                )}
              </Button>

              {/* Sort & Filter Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2" data-testid="button-sort-filter">
                    <Filter className="h-4 w-4" />
                    Sort & Filter
                    {getActiveFilterCount() > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                        {getActiveFilterCount()}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Sort & Filter</h4>
                      {getActiveFilterCount() > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearAllFilters}
                          className="h-auto py-1 px-2 text-xs"
                          data-testid="button-clear-all-filters"
                        >
                          Clear all
                        </Button>
                      )}
                    </div>

                    {/* Filter by Project Status */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Filter by Status</Label>
                        {filterProjectStatus.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {filterProjectStatus.length} selected
                          </Badge>
                        )}
                      </div>
                      <div className="border rounded-md p-2 space-y-1" data-testid="filter-status-container">
                        {projectStatusOptions.map((status) => (
                          <div key={status.value} className="flex items-center gap-2">
                            <Checkbox
                              id={`filter-status-${status.value}`}
                              data-testid={`checkbox-filter-status-${status.value}`}
                              checked={filterProjectStatus.includes(status.value)}
                              onCheckedChange={() => toggleProjectStatusFilter(status.value)}
                            />
                            <Label 
                              htmlFor={`filter-status-${status.value}`} 
                              className="font-normal text-sm cursor-pointer flex-1 flex items-center gap-2"
                            >
                              <span className={`w-3 h-3 rounded-full ${status.color} inline-block`} />
                              {status.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Filter by Projects with Caution */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Projects with Caution</Label>
                        {filterProjectsWithCaution && (
                          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                            Active
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant={filterProjectsWithCaution ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilterProjectsWithCaution(!filterProjectsWithCaution)}
                        className="w-full justify-start gap-2"
                        data-testid="button-filter-caution"
                      >
                        <AlertTriangle className={`h-4 w-4 ${filterProjectsWithCaution ? 'text-white' : 'text-amber-500'}`} />
                        <span>{filterProjectsWithCaution ? 'Showing Projects with Caution' : 'Show Projects with Caution'}</span>
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Projects missing end date or with unfilled team member roles
                      </p>
                    </div>
                    
                    {/* Sort Options */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Sort By</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={sortField === 'endDate' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleSort('endDate')}
                          data-testid="button-sort-end-date"
                          className="flex-1 justify-between"
                        >
                          <span>End Date</span>
                          {sortField === 'endDate' && (
                            <ArrowUpDown className="h-3 w-3 ml-1" />
                          )}
                        </Button>
                        <Button
                          variant={sortField === 'startDate' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleSort('startDate')}
                          data-testid="button-sort-start-date"
                          className="flex-1 justify-between"
                        >
                          <span>Start Date</span>
                          {sortField === 'startDate' && (
                            <ArrowUpDown className="h-3 w-3 ml-1" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {sortOrder === 'asc' ? 'Earliest First' : 'Latest First'}
                      </p>
                    </div>

                    {/* Filter by Name */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Filter by Name</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Search projects..."
                          value={filterProjectName}
                          onChange={(e) => setFilterProjectName(e.target.value)}
                          className="pl-9 pr-9"
                          data-testid="input-filter-project-name"
                        />
                        {filterProjectName && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setFilterProjectName('')}
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                            data-testid="button-clear-filter-name"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Filter by Lead - Multi Select with Search */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Filter by Lead</Label>
                        {filterLeads.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {filterLeads.length} selected
                          </Badge>
                        )}
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Search leads..."
                          value={filterLeadSearch}
                          onChange={(e) => setFilterLeadSearch(e.target.value)}
                          className="pl-9 pr-9"
                          data-testid="input-filter-lead-search"
                        />
                        {filterLeadSearch && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setFilterLeadSearch('')}
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="border rounded-md p-2 space-y-1 max-h-[160px] overflow-y-auto scrollbar-visible" data-testid="filter-leads-container">
                        {projectLeads
                          .filter(lead => lead.name.toLowerCase().includes(filterLeadSearch.toLowerCase()))
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((lead) => (
                          <div key={lead.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`filter-lead-${lead.id}`}
                              data-testid={`checkbox-filter-lead-${lead.id}`}
                              checked={filterLeads.includes(lead.id)}
                              onCheckedChange={() => toggleLeadFilter(lead.id)}
                            />
                            <Label 
                              htmlFor={`filter-lead-${lead.id}`} 
                              className="font-normal text-sm cursor-pointer flex-1"
                            >
                              {lead.name}
                            </Label>
                          </div>
                        ))}
                        {projectLeads.filter(lead => lead.name.toLowerCase().includes(filterLeadSearch.toLowerCase())).length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            {filterLeadSearch ? `No leads matching "${filterLeadSearch}"` : 'No leads available'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Filter by Member - Multi Select with Search */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Filter by Member</Label>
                        {filterMembers.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {filterMembers.length} selected
                          </Badge>
                        )}
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="text"
                          placeholder="Search members..."
                          value={filterMemberSearch}
                          onChange={(e) => setFilterMemberSearch(e.target.value)}
                          className="pl-9 pr-9"
                          data-testid="input-filter-member-search"
                        />
                        {filterMemberSearch && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setFilterMemberSearch('')}
                            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="border rounded-md p-2 space-y-1 max-h-[160px] overflow-y-auto scrollbar-visible" data-testid="filter-members-container">
                        {filteredMembersForFilter.map((member) => (
                          <div key={member.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`filter-member-${member.id}`}
                              data-testid={`checkbox-filter-member-${member.id}`}
                              checked={filterMembers.includes(member.id)}
                              onCheckedChange={() => toggleMemberFilter(member.id)}
                            />
                            <Label 
                              htmlFor={`filter-member-${member.id}`} 
                              className="font-normal text-sm cursor-pointer flex-1"
                            >
                              {member.name}
                            </Label>
                          </div>
                        ))}
                        {filteredMembersForFilter.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            {filterMemberSearch ? `No members matching "${filterMemberSearch}"` : 'No members available'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Filter by End Date After */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">End Date After</Label>
                        {filterEndDateAfter && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFilterEndDateAfter('')}
                            className="h-auto py-1 px-2 text-xs"
                            data-testid="button-clear-end-date-filter"
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                      <Input
                        type="date"
                        value={filterEndDateAfter}
                        onChange={(e) => setFilterEndDateAfter(e.target.value)}
                        className="w-full"
                        data-testid="input-filter-end-date-after"
                      />
                      <p className="text-xs text-muted-foreground">
                        Shows contracts ending after this date (includes N/A)
                      </p>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sortedProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-projects">
              No contracts found. Click "Add New Contract" to create one.
            </p>
          ) : (
            <>
              {/* Selection Mode Controls for Projects */}
              <div className="flex items-center gap-4 mb-4 pb-4 border-b">
                {!selectionModeProjects ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectionModeProjects(true)}
                    data-testid="button-enter-selection-projects"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Select
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectAllProjects(selectedProjects.size !== sortedProjects.length)}
                      data-testid="button-select-all-projects"
                    >
                      {selectedProjects.size === sortedProjects.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    <Badge variant="secondary">{selectedProjects.size} selected</Badge>
                    {selectedProjects.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowBulkDeleteProjects(true)}
                        data-testid="button-bulk-delete-projects"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={exitSelectionModeProjects}
                      data-testid="button-exit-selection-projects"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedProjects.slice(0, projectsToShow).map((project) => (
                <Card 
                  key={project.id} 
                  data-testid={`project-card-${project.id}`} 
                  className={`${selectedProjects.has(project.id) ? 'ring-2 ring-primary bg-primary/5' : ''} cursor-pointer hover:bg-muted/50 transition-colors`}
                  onClick={selectionModeProjects ? () => toggleProjectSelection(project.id) : () => handleProjectClick(project)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-start gap-3 flex-1">
                        {selectionModeProjects && (
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-1 ${selectedProjects.has(project.id) ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                            {selectedProjects.has(project.id) && <Check className="h-3 w-3 text-primary-foreground" />}
                          </div>
                        )}
                        <div className="flex-1">
                          <CardTitle className="text-xl flex items-center gap-2">
                            <EndDateIndicator endDate={project.endDate} />
                            {project.name}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">{project.customer}</p>
                          {project.totalContractualHours && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1" data-testid={`text-hours-${project.id}`}>
                              <Clock className="h-3 w-3" />
                              {project.totalContractualHours} hrs/week
                            </p>
                          )}
                        </div>
                      </div>
                      {!selectionModeProjects && (permissions.canEditContracts || permissions.canDeleteContracts) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              data-testid={`button-project-menu-${project.id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {permissions.canEditContracts && (
                            <DropdownMenuItem 
                              onClick={(e) => { e.stopPropagation(); startEdit(project); }}
                              data-testid={`button-edit-project-${project.id}`}
                            >
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            )}
                            {permissions.canDeleteContracts && (
                            <DropdownMenuItem 
                              onClick={(e) => { e.stopPropagation(); setDeletingProjectId(project.id); }}
                              className="text-destructive focus:text-destructive"
                              data-testid={`button-delete-project-${project.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{hasCoLeads(project) ? 'Co-Leads:' : 'Lead:'}</span>
                      <span className="text-muted-foreground">{getProjectLeadNames(project)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Team Members:</span>
                      <span className="text-muted-foreground">{getTeamMembersWithRoles(project.teamMembers).length}</span>
                    </div>

                    {(project.startDate || project.endDate) && (
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {formatDisplayDate(project.startDate)} - {formatDisplayDate(project.endDate)}
                        </span>
                      </div>
                    )}

                    {project.projectType && (
                      <div className="flex items-center gap-2 text-sm">
                        <Briefcase className="h-4 w-4 text-muted-foreground" />
                        <Badge variant="outline" className="text-xs" data-testid={`badge-project-type-${project.id}`}>
                          {project.projectType === 'CMS' ? 'Community Managed Services' : 'Strategic Services'}
                        </Badge>
                      </div>
                    )}
                    
                    {/* Caution warnings */}
                    {(!project.endDate || projectHasUnfilledRoles(project) || !project.totalContractualHours || !project.customerContactEmail) && (
                      <div className="space-y-1 mt-2">
                        {!project.endDate && (
                          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400" data-testid={`text-missing-end-date-${project.id}`}>
                            <AlertTriangle className="h-4 w-4" />
                            <span>End date is missing</span>
                          </div>
                        )}
                        {projectHasUnfilledRoles(project) && (
                          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400" data-testid={`text-unfilled-roles-${project.id}`}>
                            <AlertTriangle className="h-4 w-4" />
                            <span>Team member roles not filled</span>
                          </div>
                        )}
                        {!project.totalContractualHours && (
                          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400" data-testid={`text-missing-hours-${project.id}`}>
                            <AlertTriangle className="h-4 w-4" />
                            <span>Total contractual time missing</span>
                          </div>
                        )}
                        {!project.customerContactEmail && (
                          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400" data-testid={`text-missing-email-${project.id}`}>
                            <AlertTriangle className="h-4 w-4" />
                            <span>Customer contact email missing</span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              </div>
              {sortedProjects.length > projectsToShow && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setProjectsToShow(prev => prev + 8)}
                    data-testid="button-view-more-projects"
                  >
                    View More ({sortedProjects.length - projectsToShow} remaining)
                  </Button>
                </div>
              )}
              {projectsToShow > 8 && sortedProjects.length > 8 && (
                <div className="flex justify-center mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setProjectsToShow(8)}
                    data-testid="button-show-less-projects"
                  >
                    Show Less
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Project Dialog - Standalone outside Card to prevent event propagation issues */}
      <Dialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Contract</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Account Name <span className="text-red-500">*</span></Label>
              <Input
                id="edit-name"
                data-testid="input-edit-project-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-customer">Customer Contact Name <span className="text-red-500">*</span></Label>
              <Input
                id="edit-customer"
                data-testid="input-edit-customer"
                value={editFormData.customer}
                onChange={(e) => setEditFormData({ ...editFormData, customer: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-customer-email">Customer Contact Email <span className="text-red-500">*</span></Label>
              <Input
                id="edit-customer-email"
                data-testid="input-edit-customer-email"
                type="email"
                value={editFormData.customerContactEmail}
                onChange={(e) => setEditFormData({ ...editFormData, customerContactEmail: e.target.value })}
                placeholder="Enter customer contact email"
              />
            </div>
            <div className="space-y-2">
              <Label>Total Contractual Time</Label>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <Input
                    id="edit-contractual-hours"
                    data-testid="input-edit-contractual-hours"
                    type="text"
                    value={editFormData.contractualHours}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      setEditFormData({ ...editFormData, contractualHours: value });
                    }}
                    placeholder="Hours"
                  />
                </div>
                <span className="text-muted-foreground text-sm">hrs</span>
                <div className="flex-1">
                  <Input
                    id="edit-contractual-minutes"
                    data-testid="input-edit-contractual-minutes"
                    type="text"
                    value={editFormData.contractualMinutes}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, '');
                      const numVal = parseInt(value, 10);
                      if (value === '' || (numVal >= 0 && numVal <= 59)) {
                        setEditFormData({ ...editFormData, contractualMinutes: value });
                      }
                    }}
                    placeholder="Minutes"
                  />
                </div>
                <span className="text-muted-foreground text-sm">min</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Team Lead(s) <span className="text-red-500">*</span></Label>
                {editFormData.leadIds.length > 0 && (
                  <Badge variant="secondary" data-testid="badge-edit-lead-count">
                    {editFormData.leadIds.length} selected {editFormData.leadIds.length === 2 && '(Co-leads)'}
                  </Badge>
                )}
              </div>
              <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto" data-testid="edit-leads-selection-container">
                {[...projectLeads].sort((a, b) => a.name.localeCompare(b.name)).map((lead) => {
                  const isSelected = editFormData.leadIds.includes(lead.id);
                  return (
                    <div key={lead.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`edit-lead-${lead.id}`}
                        data-testid={`checkbox-edit-lead-${lead.id}`}
                        checked={isSelected}
                        onCheckedChange={() => {
                          const newLeadIds = isSelected
                            ? editFormData.leadIds.filter(id => id !== lead.id)
                            : [...editFormData.leadIds, lead.id];
                          setEditFormData({ ...editFormData, leadIds: newLeadIds });
                        }}
                      />
                      <Label
                        htmlFor={`edit-lead-${lead.id}`}
                        className="font-normal text-sm cursor-pointer flex-1"
                      >
                        {lead.name}
                        {editFormData.leadIds.indexOf(lead.id) === 0 && editFormData.leadIds.length > 1 && (
                          <span className="text-xs text-muted-foreground ml-2">(Primary)</span>
                        )}
                      </Label>
                    </div>
                  );
                })}
                {projectLeads.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">No project leads available</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Select one lead, or select two for co-lead. First selected becomes primary.</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Team Members <span className="text-red-500">*</span></Label>
                {editFormData.teamMembers.length > 0 && (
                  <Badge variant="secondary" data-testid="badge-edit-selected-count">
                    {editFormData.teamMembers.length} selected
                  </Badge>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search team members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                  data-testid="input-edit-search-members"
                />
                {searchQuery && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                    data-testid="button-edit-clear-search"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="border rounded-md p-4 space-y-2 max-h-64 overflow-y-auto">
                {filteredTeamMembers.length > 0 ? (
                  filteredTeamMembers.map((member) => {
                    const assignment = editFormData.teamMembers.find(m => m.memberId === member.id);
                    const isSelected = !!assignment;
                    return (
                      <div key={member.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`edit-member-${member.id}`}
                            data-testid={`checkbox-edit-member-${member.id}`}
                            checked={isSelected}
                            onCheckedChange={() => toggleTeamMember(member.id)}
                          />
                          <Label htmlFor={`edit-member-${member.id}`} className="font-normal cursor-pointer flex-1">
                            {member.name}
                          </Label>
                        </div>
                        {isSelected && (
                          <div className="ml-6 flex items-center gap-2">
                            <Select
                              value={assignment?.role || ''}
                              onValueChange={(value) => {
                                if (value === '__add_new__') {
                                  setShowAddRolePopover(`edit-${member.id}`);
                                } else {
                                  updateTeamMemberRole(member.id, value);
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 text-sm" data-testid={`select-edit-role-${member.id}`}>
                                <SelectValue placeholder="Select role..." />
                              </SelectTrigger>
                              <SelectContent>
                                {projectRoles.map((role) => (
                                  <SelectItem key={role.id} value={role.name}>
                                    {role.name}
                                  </SelectItem>
                                ))}
                                <SelectItem value="__add_new__" className="text-primary font-medium">
                                  <span className="flex items-center gap-1">
                                    <Plus className="h-3 w-3" /> Add New Role
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            {showAddRolePopover === `edit-${member.id}` && (
                              <Popover open={true} onOpenChange={() => setShowAddRolePopover(null)}>
                                <PopoverTrigger asChild>
                                  <span />
                                </PopoverTrigger>
                                <PopoverContent className="w-64" align="start">
                                  <div className="space-y-2">
                                    <Label>New Role Name</Label>
                                    <Input
                                      type="text"
                                      placeholder="Enter role name..."
                                      value={roleInputs[`edit-${member.id}`] || ''}
                                      onChange={(e) => setRoleInputs(prev => ({ ...prev, [`edit-${member.id}`]: e.target.value }))}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && (roleInputs[`edit-${member.id}`] || '').trim()) {
                                          createRoleMutation.mutate((roleInputs[`edit-${member.id}`] || '').trim());
                                        }
                                      }}
                                      data-testid={`input-new-edit-role-${member.id}`}
                                    />
                                    <div className="flex gap-2 justify-end">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setShowAddRolePopover(null);
                                          setRoleInputs(prev => ({ ...prev, [`edit-${member.id}`]: '' }));
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          if ((roleInputs[`edit-${member.id}`] || '').trim()) {
                                            createRoleMutation.mutate((roleInputs[`edit-${member.id}`] || '').trim());
                                          }
                                        }}
                                        disabled={!(roleInputs[`edit-${member.id}`] || '').trim() || createRoleMutation.isPending}
                                        data-testid={`button-save-edit-role-${member.id}`}
                                      >
                                        {createRoleMutation.isPending ? 'Adding...' : 'Add'}
                                      </Button>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No team members found matching "{searchQuery}"
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-start-date">Start Date</Label>
                <Input
                  id="edit-start-date"
                  data-testid="input-edit-start-date"
                  type="text"
                  placeholder="MM/DD/YYYY"
                  value={editStartDateInput}
                  onChange={(e) => setEditStartDateInput(formatDateInput(e.target.value))}
                  className={(!isValidDateFormat(editStartDateInput) && editStartDateInput) || validateStartDate(editStartDateInput) ? 'border-red-500' : ''}
                />
                {!isValidDateFormat(editStartDateInput) && editStartDateInput && (
                  <p className="text-xs text-red-500">Enter a valid date</p>
                )}
                {isValidDateFormat(editStartDateInput) && validateStartDate(editStartDateInput) && (
                  <p className="text-xs text-red-500">{validateStartDate(editStartDateInput)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-end-date">End Date</Label>
                <Input
                  id="edit-end-date"
                  data-testid="input-edit-end-date"
                  type="text"
                  placeholder="MM/DD/YYYY"
                  value={editEndDateInput}
                  onChange={(e) => setEditEndDateInput(formatDateInput(e.target.value))}
                  className={(!isValidDateFormat(editEndDateInput) && editEndDateInput) || validateEndDate(editStartDateInput, editEndDateInput) ? 'border-red-500' : ''}
                />
                {!isValidDateFormat(editEndDateInput) && editEndDateInput && (
                  <p className="text-xs text-red-500">Enter a valid date</p>
                )}
                {isValidDateFormat(editEndDateInput) && validateEndDate(editStartDateInput, editEndDateInput) && (
                  <p className="text-xs text-red-500">{validateEndDate(editStartDateInput, editEndDateInput)}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contract Business Nature <span className="text-red-500">*</span></Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-project-type-cms"
                    data-testid="checkbox-edit-project-type-cms"
                    checked={editFormData.projectType === 'CMS'}
                    onCheckedChange={(checked) => {
                      setEditFormData({ 
                        ...editFormData, 
                        projectType: checked ? 'CMS' : '' 
                      });
                    }}
                  />
                  <Label htmlFor="edit-project-type-cms" className="font-normal cursor-pointer">
                    Community Managed Services (CMS)
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-project-type-ss"
                    data-testid="checkbox-edit-project-type-ss"
                    checked={editFormData.projectType === 'SS'}
                    onCheckedChange={(checked) => {
                      setEditFormData({ 
                        ...editFormData, 
                        projectType: checked ? 'SS' : '' 
                      });
                    }}
                  />
                  <Label htmlFor="edit-project-type-ss" className="font-normal cursor-pointer">
                    Strategic Services (SS)
                  </Label>
                </div>
              </div>
              {!editFormData.projectType && (
                <p className="text-xs text-red-500">Project type is required</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingProject(null)}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveEdit} 
                data-testid="button-save-edit"
                disabled={editProjectMutation.isPending}
              >
                {editProjectMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Team Members Section */}
      <Card data-testid="section-team-members">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle 
              className="text-2xl flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
              onClick={() => {
                // Clear all filters when clicking "Team Members"
                setFilterLeads([]);
                setFilterMembers([]);
                setFilterProjectName('');
                setFilterProjectStatus([]);
                setFilterProjectsWithCaution(false);
                setFilterMemberRoles([]);
              }}
              data-testid="button-team-members"
            >
              <UsersRound className="h-6 w-6" />
              Team Members ({filterMemberRoles.length > 0 ? `${filteredTeamMembers.length} of ${teamMembers.length}` : teamMembers.length})
            </CardTitle>
            <div className="flex gap-2">
              {/* Filter by Role Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2" data-testid="button-filter-member-role">
                    <Filter className="h-4 w-4" />
                    Filter by Role
                    {filterMemberRoles.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                        {filterMemberRoles.length}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3" align="end">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">Filter by Role</p>
                      {filterMemberRoles.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearMemberRoleFilters}
                          className="h-auto py-1 px-2 text-xs"
                          data-testid="button-clear-role-filters"
                        >
                          Clear all
                        </Button>
                      )}
                    </div>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search roles..."
                        value={memberRoleSearchQuery}
                        onChange={(e) => setMemberRoleSearchQuery(e.target.value)}
                        className="pl-8 h-9"
                        data-testid="input-search-roles"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {getAllUniqueRoles()
                        .filter(role => role.toLowerCase().includes(memberRoleSearchQuery.toLowerCase()))
                        .map(role => (
                          <div
                            key={role}
                            className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                            onClick={() => toggleMemberRoleFilter(role)}
                            data-testid={`filter-role-${role.replace(/\s+/g, '-').toLowerCase()}`}
                          >
                            <Checkbox
                              checked={filterMemberRoles.includes(role)}
                              onCheckedChange={() => toggleMemberRoleFilter(role)}
                            />
                            <span className="text-sm truncate">{role}</span>
                          </div>
                        ))}
                      {getAllUniqueRoles().filter(role => role.toLowerCase().includes(memberRoleSearchQuery.toLowerCase())).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-2">No roles found</p>
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              {permissions.canAddTeamMembers && (
              <Dialog open={showAddMemberDialog} onOpenChange={(open) => {
                setShowAddMemberDialog(open);
                if (!open) {
                  setNewMember('');
                  setMemberNameError(null);
                  setMemberNameWarning(null);
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="default" className="gap-2" data-testid="button-add-member">
                    <UserPlus className="h-4 w-4" />
                    Add Team Member
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Team Member</DialogTitle>
                  <DialogDescription>
                    Add a new team member to the system.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-member-name">Team Member Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="new-member-name"
                      data-testid="input-member-name"
                      type="text"
                      value={newMember}
                      onChange={(e) => handleMemberNameChange(e.target.value)}
                      placeholder="Enter team member name"
                      className={memberNameError ? 'border-red-500' : memberNameWarning ? 'border-amber-500' : ''}
                    />
                    {memberNameError && (
                      <p className="text-sm text-red-500" data-testid="error-member-duplicate">{memberNameError}</p>
                    )}
                    {memberNameWarning && (
                      <p className="text-sm text-amber-600" data-testid="warning-member-similar">{memberNameWarning}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-member-email">Email (Optional)</Label>
                    <p className="text-xs text-muted-foreground">Essential for enabling co-worker feedback option</p>
                    <div className="flex">
                      <Input
                        id="new-member-email"
                        data-testid="input-member-email"
                        type="text"
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value.replace(/@.*$/, ''))}
                        placeholder="username"
                        className="rounded-r-none"
                      />
                      <span className="inline-flex items-center px-3 bg-muted border border-l-0 border-input rounded-r-md text-sm text-muted-foreground">
                        @ignitetech.com
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddMemberDialog(false);
                        setNewMember('');
                        setNewMemberEmail('');
                        setMemberNameError(null);
                        setMemberNameWarning(null);
                      }}
                      data-testid="button-cancel-add-member"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddMember}
                      disabled={createMemberMutation.isPending || !newMember.trim() || !!memberNameError}
                      data-testid="button-submit-member"
                    >
                      {createMemberMutation.isPending ? 'Adding...' : 'Add Member'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
              </Dialog>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {teamMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-members">
              No team members added yet. {permissions.canAddTeamMembers ? 'Click "Add Team Member" to add one.' : ''}
            </p>
          ) : (
            <>
              {/* Selection Mode Controls for Members */}
              <div className="flex items-center gap-4 mb-4 pb-4 border-b">
                {!selectionModeMembers ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectionModeMembers(true)}
                    data-testid="button-enter-selection-members"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Select
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectAllMembers(selectedMembers.size !== teamMembers.length)}
                      data-testid="button-select-all-members"
                    >
                      {selectedMembers.size === teamMembers.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    <Badge variant="secondary">{selectedMembers.size} selected</Badge>
                    {selectedMembers.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowBulkDeleteMembers(true)}
                        data-testid="button-bulk-delete-members"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={exitSelectionModeMembers}
                      data-testid="button-exit-selection-members"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredTeamMembers.slice(0, membersToShow).map((member) => (
              <div
                key={member.id}
                className={`flex items-center justify-between bg-muted/50 p-3 rounded-md transition-colors cursor-pointer ${selectedMembers.has(member.id) ? 'ring-2 ring-primary bg-primary/5' : ''} ${selectionModeMembers ? 'hover:bg-muted' : 'hover:bg-muted/70'}`}
                data-testid={`member-item-${member.id}`}
                onClick={selectionModeMembers ? () => toggleMemberSelection(member.id) : () => handleMemberTileClick(member)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {selectionModeMembers && (
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${selectedMembers.has(member.id) ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                      {selectedMembers.has(member.id) && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                  )}
                  <div className="min-w-0">
                    <span data-testid={`text-member-${member.id}`} className="font-medium block truncate">
                      {member.name}
                    </span>
                  </div>
                </div>
                {!selectionModeMembers && (permissions.canEditTeamMembers || permissions.canDeletePeople) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        data-testid={`button-member-menu-${member.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {permissions.canEditTeamMembers && (
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditMember(member);
                        }}
                        data-testid={`button-edit-member-${member.id}`}
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      )}
                      {permissions.canDeletePeople && (
                      <DropdownMenuItem 
                        onClick={() => deleteMemberMutation.mutate(member.id)}
                        disabled={deleteMemberMutation.isPending}
                        className="text-destructive focus:text-destructive"
                        data-testid={`button-delete-member-${member.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              ))}
              </div>
              {filteredTeamMembers.length > membersToShow && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setMembersToShow(prev => prev + 15)}
                    data-testid="button-view-more-members"
                  >
                    View More ({filteredTeamMembers.length - membersToShow} remaining)
                  </Button>
                </div>
              )}
              {membersToShow > 15 && filteredTeamMembers.length > 15 && (
                <div className="flex justify-center mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMembersToShow(15)}
                    data-testid="button-show-less-members"
                  >
                    Show Less
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Team Leads Section */}
      <Card data-testid="section-project-leads">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle 
              className="text-2xl flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
              onClick={() => {
                // Clear all filters when clicking "Team Leads"
                setFilterLeads([]);
                setFilterMembers([]);
                setFilterProjectName('');
                setFilterProjectStatus([]);
                setFilterProjectsWithCaution(false);
                setFilterMemberRoles([]);
              }}
              data-testid="button-team-leads"
            >
              <UserCog className="h-6 w-6" />
              Team Leads ({projectLeads.length})
            </CardTitle>
            <div className="flex gap-2">
              {permissions.canAddProjectLeads && (
              <Dialog open={showAddLeadDialog} onOpenChange={(open) => {
                setShowAddLeadDialog(open);
                if (!open) {
                  setNewLead('');
                  setNewLeadEmail('');
                  setLeadNameError(null);
                  setLeadNameWarning(null);
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="default" className="gap-2" data-testid="button-add-lead">
                    <UserPlus className="h-4 w-4" />
                    Add Team Lead
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Team Lead</DialogTitle>
                  <DialogDescription>
                    Add a new team lead to the system.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="new-lead-name">Team Lead Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="new-lead-name"
                      data-testid="input-lead-name"
                      type="text"
                      value={newLead}
                      onChange={(e) => handleLeadNameChange(e.target.value)}
                      placeholder="Enter team lead name"
                      className={leadNameError ? 'border-red-500' : leadNameWarning ? 'border-amber-500' : ''}
                    />
                    {leadNameError && (
                      <p className="text-sm text-red-500" data-testid="error-lead-duplicate">{leadNameError}</p>
                    )}
                    {leadNameWarning && (
                      <p className="text-sm text-amber-600" data-testid="warning-lead-similar">{leadNameWarning}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-lead-email">Email Address</Label>
                    <p className="text-xs text-muted-foreground">Essential for enabling co-worker feedback option</p>
                    <div className="flex">
                      <Input
                        id="new-lead-email"
                        data-testid="input-lead-email"
                        type="text"
                        value={newLeadEmail}
                        onChange={(e) => setNewLeadEmail(e.target.value.replace(/@.*$/, ''))}
                        placeholder="username (optional)"
                        className="rounded-r-none"
                      />
                      <span className="inline-flex items-center px-3 bg-muted border border-l-0 border-input rounded-r-md text-sm text-muted-foreground">
                        @ignitetech.com
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowAddLeadDialog(false);
                        setNewLead('');
                        setNewLeadEmail('');
                        setLeadNameError(null);
                        setLeadNameWarning(null);
                      }}
                      data-testid="button-cancel-add-lead"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddLead}
                      disabled={createLeadMutation.isPending || !newLead.trim() || !!leadNameError}
                      data-testid="button-submit-lead"
                    >
                      {createLeadMutation.isPending ? 'Adding...' : 'Add Lead'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
              </Dialog>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {projectLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-leads">
              No team leads added yet. {permissions.canAddProjectLeads ? 'Click "Add Team Lead" to add one.' : ''}
            </p>
          ) : (
            <>
              {/* Selection Mode Controls for Leads */}
              <div className="flex items-center gap-4 mb-4 pb-4 border-b">
                {!selectionModeLeads ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectionModeLeads(true)}
                    data-testid="button-enter-selection-leads"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Select
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectAllLeads(selectedLeads.size !== projectLeads.length)}
                      data-testid="button-select-all-leads"
                    >
                      {selectedLeads.size === projectLeads.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    <Badge variant="secondary">{selectedLeads.size} selected</Badge>
                    {selectedLeads.size > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowBulkDeleteLeads(true)}
                        data-testid="button-bulk-delete-leads"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={exitSelectionModeLeads}
                      data-testid="button-exit-selection-leads"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {[...projectLeads].sort((a, b) => a.name.localeCompare(b.name)).slice(0, leadsToShow).map((lead) => (
              <div
                key={lead.id}
                className={`flex items-center justify-between bg-muted/50 p-3 rounded-md transition-colors cursor-pointer hover:bg-muted ${selectedLeads.has(lead.id) ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                data-testid={`lead-item-${lead.id}`}
                onClick={() => {
                  if (selectionModeLeads) {
                    toggleLeadSelection(lead.id);
                  } else {
                    handleLeadTileClick(lead);
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  {selectionModeLeads && (
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selectedLeads.has(lead.id) ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                      {selectedLeads.has(lead.id) && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                  )}
                  <span data-testid={`text-lead-${lead.id}`} className="font-medium">
                    {lead.name}
                  </span>
                </div>
                {!selectionModeLeads && (permissions.canEditProjectLeads || permissions.canDeletePeople) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        data-testid={`button-lead-menu-${lead.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {permissions.canEditProjectLeads && (
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); startEditLead(lead); }}
                        data-testid={`button-edit-lead-${lead.id}`}
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      )}
                      {permissions.canDeletePeople && (
                      <DropdownMenuItem 
                        onClick={(e) => { e.stopPropagation(); deleteLeadMutation.mutate(lead.id); }}
                        disabled={deleteLeadMutation.isPending}
                        className="text-destructive focus:text-destructive"
                        data-testid={`button-delete-lead-${lead.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              ))}
              </div>
              {projectLeads.length > leadsToShow && (
                <div className="flex justify-center mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setLeadsToShow(prev => prev + 15)}
                    data-testid="button-view-more-leads"
                  >
                    View More ({projectLeads.length - leadsToShow} remaining)
                  </Button>
                </div>
              )}
              {leadsToShow > 15 && projectLeads.length > 15 && (
                <div className="flex justify-center mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLeadsToShow(15)}
                    data-testid="button-show-less-leads"
                  >
                    Show Less
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Project Confirmation Dialog */}
      <Dialog open={!!deletingProjectId} onOpenChange={(open) => !open && setDeletingProjectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this project? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setDeletingProjectId(null)}
              data-testid="button-cancel-delete-project"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deletingProjectId) {
                  deleteProjectMutation.mutate(deletingProjectId);
                }
              }}
              disabled={deleteProjectMutation.isPending}
              data-testid="button-confirm-delete-project"
            >
              {deleteProjectMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Projects Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteProjects} onOpenChange={setShowBulkDeleteProjects}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedProjects.size} Project(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedProjects.size} selected project(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete-projects">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteProjectsMutation.mutate(Array.from(selectedProjects))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-bulk-delete-projects"
            >
              {bulkDeleteProjectsMutation.isPending ? 'Deleting...' : 'Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Members Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteMembers} onOpenChange={setShowBulkDeleteMembers}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedMembers.size} Team Member(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedMembers.size} selected team member(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete-members">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMembersMutation.mutate(Array.from(selectedMembers))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-bulk-delete-members"
            >
              {bulkDeleteMembersMutation.isPending ? 'Deleting...' : 'Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Leads Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteLeads} onOpenChange={setShowBulkDeleteLeads}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedLeads.size} Team Lead(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedLeads.size} selected project lead(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete-leads">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteLeadsMutation.mutate(Array.from(selectedLeads))}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-bulk-delete-leads"
            >
              {bulkDeleteLeadsMutation.isPending ? 'Deleting...' : 'Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Project Detail Modal */}
      <Dialog open={showProjectDetailModal} onOpenChange={(open) => !open && closeProjectDetailModal()}>
        <DialogContent className="max-w-lg" data-testid="dialog-project-detail">
          <DialogHeader className="pb-4 border-b">
            <div className="flex items-center gap-3">
              {selectedProject && <EndDateIndicator endDate={selectedProject.endDate} />}
              <DialogTitle className="text-2xl">{selectedProject?.name}</DialogTitle>
            </div>
            <DialogDescription className="sr-only">
              View detailed information about this project including customer, lead, team members, and timeline.
            </DialogDescription>
          </DialogHeader>
          
          {selectedProject && (
            <div className="space-y-6 py-4">
              {/* Customer Section */}
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Customer Contact Name</p>
                  <p className="text-lg font-semibold" data-testid="text-project-detail-customer">{selectedProject.customer}</p>
                  {selectedProject.customerContactEmail && (
                    <p className="text-sm text-primary flex items-center gap-1.5 mt-1" data-testid="text-project-detail-customer-email">
                      <Mail className="h-3.5 w-3.5" />
                      {selectedProject.customerContactEmail}
                    </p>
                  )}
                </div>
              </div>

              {/* Contractual Time Section */}
              {selectedProject.totalContractualHours && (
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Contractual Time</p>
                    <p className="text-lg font-semibold" data-testid="text-project-detail-hours">{formatContractualTime(selectedProject.totalContractualHours)}</p>
                  </div>
                </div>
              )}

              {/* Project Lead Section - with clickable email (supports co-leads) */}
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <UserCog className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {hasCoLeads(selectedProject) ? 'Team Leads (Co-Lead)' : 'Team Lead'}
                  </p>
                  <div className="space-y-2">
                    {(selectedProject.leadIds && selectedProject.leadIds.length > 0 
                      ? selectedProject.leadIds 
                      : [selectedProject.leadId]
                    ).map((leadId) => (
                      <div key={leadId}>
                        <div 
                          className="flex items-center gap-2 cursor-pointer group"
                          onClick={() => toggleLeadEmailVisibility(leadId)}
                          data-testid={`button-toggle-lead-email-${leadId}`}
                        >
                          <p className="text-lg font-semibold group-hover:text-primary transition-colors" data-testid={`text-project-detail-lead-${leadId}`}>
                            {getLeadName(leadId)}
                          </p>
                          <Mail className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        {visibleLeadEmails.has(leadId) && (
                          <div className="mt-1 flex items-center gap-2 text-sm text-primary animate-in fade-in duration-200" data-testid={`text-lead-email-${leadId}`}>
                            <Mail className="h-3.5 w-3.5" />
                            {getLeadById(leadId)?.email || 'No email set'}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Team Members Section */}
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Team Members</p>
                  <div className="flex flex-wrap gap-2" data-testid="container-project-detail-team">
                    {getTeamMembersWithRoles(selectedProject.teamMembers).map((member, idx) => (
                      <Badge key={idx} variant="secondary" className="text-sm py-1 flex items-center gap-1.5">
                        <span>{member.name}</span>
                        {member.role && (
                          <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded-sm">
                            {member.role}
                          </span>
                        )}
                      </Badge>
                    ))}
                    {(!selectedProject.teamMembers || (selectedProject.teamMembers as TeamMemberAssignment[]).length === 0) && (
                      <p className="text-sm text-muted-foreground">No team members assigned</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Dates Section */}
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Project Timeline</p>
                  <div className="flex items-center gap-2 mt-1" data-testid="text-project-detail-dates">
                    <span className="text-base">{selectedProject.startDate ? formatDisplayDate(selectedProject.startDate) : 'Not set'}</span>
                    <span className="text-muted-foreground">to</span>
                    <span className="text-base">{selectedProject.endDate ? formatDisplayDate(selectedProject.endDate) : 'Not set'}</span>
                  </div>
                  {!selectedProject.endDate && (
                    <div className="flex items-center gap-1.5 mt-1 text-warning text-sm">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span>End date is missing</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Project Type Section */}
              {selectedProject.projectType && (
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Briefcase className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Project Type</p>
                    <Badge variant="outline" className="mt-1" data-testid="badge-project-detail-type">
                      {selectedProject.projectType === 'CMS' ? 'Community Managed Services' : 'Strategic Services'}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Status Indicator */}
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  {(() => {
                    const status = getProjectStatus(selectedProject.endDate);
                    if (status === 'active') {
                      return (
                        <Badge className="mt-1 bg-success/20 text-success border-success/30" data-testid="badge-project-detail-status">
                          Long-term Active
                        </Badge>
                      );
                    } else if (status === 'renewal') {
                      return (
                        <Badge className="mt-1 bg-warning/20 text-warning border-warning/30" data-testid="badge-project-detail-status">
                          Renewal Soon
                        </Badge>
                      );
                    } else {
                      return (
                        <Badge className="mt-1 bg-destructive/20 text-destructive border-destructive/30" data-testid="badge-project-detail-status">
                          Ended
                        </Badge>
                      );
                    }
                  })()}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Lead Dialog */}
      <Dialog open={showEditLeadDialog} onOpenChange={(open) => !open && cancelEditLead()}>
        <DialogContent data-testid="dialog-edit-lead">
          <DialogHeader>
            <DialogTitle>Edit Team Lead</DialogTitle>
            <DialogDescription>
              Update the team lead's name and email address.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-lead-name">Team Lead Name <span className="text-red-500">*</span></Label>
              <Input
                id="edit-lead-name"
                data-testid="input-edit-lead-name"
                type="text"
                value={editLeadValue}
                onChange={(e) => setEditLeadValue(e.target.value)}
                placeholder="Enter team lead name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-lead-email">Email Address</Label>
              <p className="text-xs text-muted-foreground">Essential for enabling co-worker feedback option</p>
              <div className="flex">
                <Input
                  id="edit-lead-email"
                  data-testid="input-edit-lead-email"
                  type="text"
                  value={editLeadEmailValue}
                  onChange={(e) => setEditLeadEmailValue(e.target.value.replace(/@.*$/, ''))}
                  placeholder="username (optional)"
                  className="rounded-r-none"
                />
                <span className="inline-flex items-center px-3 bg-muted border border-l-0 border-input rounded-r-md text-sm text-muted-foreground">
                  @ignitetech.com
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={cancelEditLead}
                data-testid="button-cancel-edit-lead"
              >
                Cancel
              </Button>
              <Button
                onClick={saveEditLead}
                disabled={updateLeadMutation.isPending || !editLeadValue.trim()}
                data-testid="button-save-edit-lead"
              >
                {updateLeadMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={showEditMemberDialog} onOpenChange={(open) => !open && cancelEditMember()}>
        <DialogContent data-testid="dialog-edit-member">
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>
              Update the team member's name and email address.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-member-name">Team Member Name <span className="text-red-500">*</span></Label>
              <Input
                id="edit-member-name"
                data-testid="input-edit-member-name"
                type="text"
                value={editMemberValue}
                onChange={(e) => setEditMemberValue(e.target.value)}
                placeholder="Enter team member name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-member-email">Email Address (Optional)</Label>
              <p className="text-xs text-muted-foreground">Essential for enabling co-worker feedback option</p>
              <div className="flex">
                <Input
                  id="edit-member-email"
                  data-testid="input-edit-member-email"
                  type="text"
                  value={editMemberEmailValue}
                  onChange={(e) => setEditMemberEmailValue(e.target.value.replace(/@.*$/, ''))}
                  placeholder="username"
                  className="rounded-r-none"
                />
                <span className="inline-flex items-center px-3 bg-muted border border-l-0 border-input rounded-r-md text-sm text-muted-foreground">
                  @ignitetech.com
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={cancelEditMember}
                data-testid="button-cancel-edit-member"
              >
                Cancel
              </Button>
              <Button
                onClick={saveEditMember}
                disabled={updateMemberMutation.isPending || !editMemberValue.trim()}
                data-testid="button-save-edit-member"
              >
                {updateMemberMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lead Detail Modal */}
      <Dialog open={showLeadDetailModal} onOpenChange={(open) => !open && closeLeadDetailModal()}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-lead-detail">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Team Lead Details
            </DialogTitle>
            <DialogDescription className="sr-only">
              View details about this project lead including their email and projects they manage.
            </DialogDescription>
          </DialogHeader>
          {selectedLeadForDetail && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserCog className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-semibold" data-testid="text-lead-detail-name">
                    {selectedLeadForDetail.name}
                  </p>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mt-0.5">
                    <Mail className="h-3.5 w-3.5" />
                    <span data-testid="text-lead-detail-email">
                      {selectedLeadForDetail.email || 'No email set'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Projects managed by this lead (includes co-lead projects) - max 4 shown */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Contracts Led</p>
                {(() => {
                  const ledProjects = projects.filter(p => {
                    // Check leadIds array first (co-lead support), then fall back to leadId
                    const projectLeadIds = p.leadIds && p.leadIds.length > 0 ? p.leadIds : [p.leadId];
                    return projectLeadIds.includes(selectedLeadForDetail.id);
                  });
                  if (ledProjects.length === 0) {
                    return (
                      <p className="text-sm text-muted-foreground italic">No contracts assigned</p>
                    );
                  }
                  const displayedProjects = showAllLeadContracts ? ledProjects : ledProjects.slice(0, 4);
                  const remainingCount = ledProjects.length - 4;
                  return (
                    <div className="space-y-2" data-testid="list-lead-projects">
                      {displayedProjects.map(project => (
                        <div key={project.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{project.name}</span>
                            {hasCoLeads(project) && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground">
                                Co-Lead
                              </Badge>
                            )}
                          </div>
                          {(() => {
                            const status = getProjectStatus(project.endDate);
                            if (status === 'active') {
                              return <Badge className="bg-success/20 text-success border-success/30 text-xs">Active</Badge>;
                            } else if (status === 'renewal') {
                              return <Badge className="bg-warning/20 text-warning border-warning/30 text-xs">Renewal</Badge>;
                            } else {
                              return <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-xs">Ended</Badge>;
                            }
                          })()}
                        </div>
                      ))}
                      {remainingCount > 0 && !showAllLeadContracts && (
                        <button
                          type="button"
                          onClick={() => setShowAllLeadContracts(true)}
                          className="text-xs text-primary hover:underline text-center w-full pt-1 cursor-pointer"
                          data-testid="button-show-more-lead-contracts"
                        >
                          +{remainingCount} more contract{remainingCount > 1 ? 's' : ''}
                        </button>
                      )}
                      {showAllLeadContracts && ledProjects.length > 4 && (
                        <button
                          type="button"
                          onClick={() => setShowAllLeadContracts(false)}
                          className="text-xs text-primary hover:underline text-center w-full pt-1 cursor-pointer"
                          data-testid="button-show-less-lead-contracts"
                        >
                          Show less
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Anonymous Feedback Submission Section - Hidden for non-team members and self-feedback */}
              {!canSubmitFeedback ? (
                null
              ) : user?.email?.toLowerCase() === selectedLeadForDetail.email?.toLowerCase() ? (
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-sm italic">You cannot submit feedback about yourself.</p>
                  </div>
                </div>
              ) : (
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium">Submit Feedback</p>
                  </div>
                  <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span>Only fill this form if you have worked with this person this week.</span>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Shield className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span>Your feedback is anonymous and will not be attributed to you.</span>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-warning">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span>This feedback cannot be edited after submission. Please re-check and be careful before submitting.</span>
                    </div>
                    <Textarea
                      value={leadFeedbackValue}
                      onChange={(e) => setLeadFeedbackValue(e.target.value)}
                      placeholder="Share your feedback about working with this person..."
                      rows={3}
                      className="mt-2"
                      data-testid="textarea-lead-feedback"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (leadFeedbackValue.trim()) {
                            submitLeadFeedbackMutation.mutate({ 
                              id: selectedLeadForDetail.id, 
                              feedback: leadFeedbackValue 
                            });
                          }
                        }}
                        disabled={submitLeadFeedbackMutation.isPending || !leadFeedbackValue.trim()}
                        data-testid="button-submit-lead-feedback"
                      >
                        {submitLeadFeedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Team Member Detail Modal */}
      <Dialog open={showMemberDetailModal} onOpenChange={(open) => !open && closeMemberDetailModal()}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-member-detail">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Team Member Details
            </DialogTitle>
            <DialogDescription className="sr-only">
              View details about this team member including projects they work on and their roles.
            </DialogDescription>
          </DialogHeader>
          {selectedMemberForDetail && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-semibold" data-testid="text-member-detail-name">
                    {selectedMemberForDetail.name}
                  </p>
                </div>
              </div>
              
              {/* Projects this member is working on (only active/renewal) - max 4 shown */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Contracts & Roles</p>
                {(() => {
                  const memberProjects = getMemberProjects(selectedMemberForDetail.id)
                    .filter(({ project }) => {
                      const status = getProjectStatus(project.endDate);
                      return status === 'active' || status === 'renewal';
                    });
                  if (memberProjects.length === 0) {
                    return (
                      <p className="text-sm text-muted-foreground italic">No active contracts</p>
                    );
                  }
                  const displayedProjects = showAllMemberContracts ? memberProjects : memberProjects.slice(0, 4);
                  const remainingCount = memberProjects.length - 4;
                  return (
                    <div className="space-y-2" data-testid="list-member-projects">
                      {displayedProjects.map(({ project, role }) => (
                        <div key={project.id} className="flex flex-col gap-1 p-2 bg-muted/30 rounded-md">
                          <span className="text-sm font-medium truncate">{project.name}</span>
                          <Badge variant="secondary" className="text-xs font-medium w-fit max-w-full">
                            <span className="truncate">{role}</span>
                          </Badge>
                        </div>
                      ))}
                      {remainingCount > 0 && !showAllMemberContracts && (
                        <button
                          type="button"
                          onClick={() => setShowAllMemberContracts(true)}
                          className="text-xs text-primary hover:underline text-center w-full pt-1 cursor-pointer"
                          data-testid="button-show-more-member-contracts"
                        >
                          +{remainingCount} more contract{remainingCount > 1 ? 's' : ''}
                        </button>
                      )}
                      {showAllMemberContracts && memberProjects.length > 4 && (
                        <button
                          type="button"
                          onClick={() => setShowAllMemberContracts(false)}
                          className="text-xs text-primary hover:underline text-center w-full pt-1 cursor-pointer"
                          data-testid="button-show-less-member-contracts"
                        >
                          Show less
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Anonymous Feedback Submission Section - Hidden for non-team members and self-feedback */}
              {!canSubmitFeedback ? (
                null
              ) : user?.email?.toLowerCase() === selectedMemberForDetail.email?.toLowerCase() ? (
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-sm italic">You cannot submit feedback about yourself.</p>
                  </div>
                </div>
              ) : (
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium">Submit Feedback</p>
                  </div>
                  <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span>Only fill this form if you have worked with this person this week.</span>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Shield className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span>Your feedback is anonymous and will not be attributed to you.</span>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-warning">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span>This feedback cannot be edited after submission. Please re-check and be careful before submitting.</span>
                    </div>
                    <Textarea
                      value={memberFeedbackValue}
                      onChange={(e) => setMemberFeedbackValue(e.target.value)}
                      placeholder="Share your feedback about working with this person..."
                      rows={3}
                      className="mt-2"
                      data-testid="textarea-member-feedback"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (memberFeedbackValue.trim()) {
                            submitMemberFeedbackMutation.mutate({ 
                              id: selectedMemberForDetail.id, 
                              feedback: memberFeedbackValue 
                            });
                          }
                        }}
                        disabled={submitMemberFeedbackMutation.isPending || !memberFeedbackValue.trim()}
                        data-testid="button-submit-member-feedback"
                      >
                        {submitMemberFeedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
