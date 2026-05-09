export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export interface Worker {
  id?: string;
  name: string;
  phone: string;
  role: string;
  createdAt: any;
}

export interface AttendanceRecord {
  id?: string;
  workerId: string;
  workerName: string;
  date: string; // YYYY-MM-DD
  inTime: any;
  outTime?: any;
  overtimeMinutes?: number;
  totalMinutes?: number;
  status: 'present' | 'absent';
  hasReport?: boolean;
}

export interface WorkReport {
  id?: string;
  attendanceId: string;
  workerId: string;
  content: string;
  imageUrl?: string;
  createdAt: any;
}
