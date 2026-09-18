import { db } from '../db/database.js';
import { 
  TimeSlot, 
  Appointment, 
  AppointmentStatus, 
  ConsultationType,
  BlockedSlot 
} from '../types/entities.js';
import { v4 as uuidv4 } from 'uuid';

export interface AvailabilityFilter {
  doctorId?: string;
  hospitalId?: string;
  specialty?: string;
  startDate?: string;
  endDate?: string;
  consultationType?: ConsultationType;
}

export class SchedulingService {
  /**
   * Calculates strictly real availability. The AI must never invent slots (PRD Section 7).
   */
  public getAvailableSlots(filter: AvailabilityFilter): TimeSlot[] {
    const { doctorId, hospitalId, specialty, startDate, endDate } = filter;

    // Filter active approved hospitals only
    const allHospitals = db.getHospitals();
    const approvedHospitalIds = new Set(
      allHospitals.filter(h => h.status === 'Approved').map(h => h.id)
    );

    // Filter active doctors only
    const allDoctors = db.getDoctors();
    const activeDoctors = allDoctors.filter(d => 
      d.status === 'Active' && 
      approvedHospitalIds.has(d.hospitalId) &&
      (!hospitalId || d.hospitalId === hospitalId) &&
      (!doctorId || d.id === doctorId) &&
      (!specialty || d.specialty.toLowerCase() === specialty.toLowerCase())
    );

    const activeDoctorIds = new Set(activeDoctors.map(d => d.id));
    const nowMs = Date.now();

    // Fetch candidate slots
    const candidateSlots = db.getSlots().filter(slot => {
      if (!activeDoctorIds.has(slot.doctorId)) return false;
      if (!slot.isAvailable) return false;

      // Check atomic lock expiry
      if (slot.reservationLockedUntil && slot.reservationLockedUntil > nowMs) {
        return false;
      }

      // *** CRITICAL: Filter out past slots — never show slots whose start time has already passed ***
      const slotTime = new Date(slot.startTime).getTime();
      if (slotTime <= nowMs) {
        return false;
      }

      // Date range filtering
      if (startDate && slotTime < new Date(startDate).getTime()) return false;
      if (endDate && slotTime > new Date(endDate).getTime()) return false;

      // Verify doctor blocked periods
      const blockedPeriods = db.getBlockedSlots(slot.doctorId);
      const slotStart = new Date(slot.startTime).getTime();
      const slotEnd = new Date(slot.endTime).getTime();

      const isBlocked = blockedPeriods.some(b => {
        const bStart = new Date(b.startTime).getTime();
        const bEnd = new Date(b.endTime).getTime();
        return (slotStart < bEnd && slotEnd > bStart);
      });

      if (isBlocked) return false;

      return true;
    });

    return candidateSlots;
  }

  /**
   * Atomically reserve a slot to prevent concurrent double-booking (PRD Section 7).
   * Example: Patient A and Patient B both wanting 3:00 PM -> only one succeeds!
   */
  public reserveSlot(slotId: string, patientId: string, durationMs: number = 60000): {
    success: boolean;
    slot?: TimeSlot;
    error?: string;
  } {
    const slot = db.getSlotById(slotId);
    if (!slot) {
      return { success: false, error: `Slot ${slotId} not found.` };
    }

    if (!slot.isAvailable) {
      return { success: false, error: `Slot ${slotId} is already booked.` };
    }

    const acquired = db.acquireSlotLock(slotId, patientId, durationMs);
    if (!acquired) {
      return { 
        success: false, 
        error: `Slot ${slotId} is currently reserved by another patient. Please choose an adjacent slot.` 
      };
    }

    return { success: true, slot: db.getSlotById(slotId) };
  }

  /**
   * Release an acquired reservation lock.
   */
  public releaseReservation(slotId: string): void {
    db.releaseSlotLock(slotId);
  }

  /**
   * Validates slot availability immediately prior to durable booking (PRD Section 7).
   */
  public revalidateSlot(slotId: string, patientId: string): boolean {
    const slot = db.getSlotById(slotId);
    if (!slot || !slot.isAvailable) return false;

    // If locked, it must be locked by this patient
    if (slot.reservationLockedUntil && slot.reservationLockedUntil > Date.now()) {
      if (slot.reservedByPatientId !== patientId) {
        return false;
      }
    }

    // Check doctor status
    const doc = db.getDoctorById(slot.doctorId);
    if (!doc || doc.status !== 'Active') return false;

    // Check blocked slots
    const blockedPeriods = db.getBlockedSlots(slot.doctorId);
    const slotStart = new Date(slot.startTime).getTime();
    const slotEnd = new Date(slot.endTime).getTime();
    const isBlocked = blockedPeriods.some(b => {
      const bStart = new Date(b.startTime).getTime();
      const bEnd = new Date(b.endTime).getTime();
      return (slotStart < bEnd && slotEnd > bStart);
    });

    return !isBlocked;
  }

  /**
   * Creates an appointment with idempotency checking and proper state transition.
   */
  public createAppointmentRecord(params: {
    patientId: string;
    slotId: string;
    reasonForVisit: string;
    consultationType?: ConsultationType;
    correlationId: string;
    idempotencyKey: string;
  }): {
    success: boolean;
    appointment?: Appointment;
    error?: string;
    isDuplicate?: boolean;
  } {
    const { patientId, slotId, reasonForVisit, consultationType = 'in-person', correlationId, idempotencyKey } = params;

    // Check idempotency first (PRD Section 25)
    const existing = db.findAppointmentByIdempotency(idempotencyKey);
    if (existing) {
      return { success: true, appointment: existing, isDuplicate: true };
    }

    // Revalidate slot
    if (!this.revalidateSlot(slotId, patientId)) {
      return { 
        success: false, 
        error: `Slot ${slotId} is no longer available or was booked by another patient.` 
      };
    }

    const slot = db.getSlotById(slotId)!;
    const appointmentId = `appt-${uuidv4().substring(0, 8)}`;

    const newAppointment: Appointment = {
      id: appointmentId,
      hospitalId: slot.hospitalId,
      doctorId: slot.doctorId,
      patientId,
      slotId,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: 'Requested',
      consultationType,
      reasonForVisit,
      correlationId,
      idempotencyKey,
      verificationStatus: 'Pending',
      statusHistory: [
        {
          status: 'Requested',
          timestamp: new Date().toISOString(),
          changedBy: `Patient:${patientId}`,
          reason: 'Initial booking request via AI agent'
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save appointment & lock slot to prevent race condition
    db.saveAppointment(newAppointment);
    db.markSlotBooked(slotId, appointmentId);

    return { success: true, appointment: newAppointment };
  }

  /**
   * Reschedules an existing appointment to a newly verified slot.
   */
  public rescheduleAppointment(appointmentId: string, newSlotId: string, reason: string): {
    success: boolean;
    appointment?: Appointment;
    error?: string;
  } {
    const appt = db.getAppointmentById(appointmentId);
    if (!appt) {
      return { success: false, error: `Appointment ${appointmentId} not found.` };
    }

    if (appt.status === 'Cancelled' || appt.status === 'Completed') {
      return { success: false, error: `Cannot reschedule appointment in status '${appt.status}'.` };
    }

    // Revalidate new slot
    const newSlot = db.getSlotById(newSlotId);
    if (!newSlot || !newSlot.isAvailable) {
      return { success: false, error: `Requested new slot ${newSlotId} is unavailable.` };
    }

    const oldSlotId = appt.slotId;

    // Release old slot and book new slot
    db.markSlotAvailable(oldSlotId);
    db.markSlotBooked(newSlotId, appt.id);

    // Update appointment record
    appt.slotId = newSlotId;
    appt.startTime = newSlot.startTime;
    appt.endTime = newSlot.endTime;
    appt.status = 'Rescheduled';
    appt.updatedAt = new Date().toISOString();
    appt.statusHistory.push({
      status: 'Rescheduled',
      timestamp: new Date().toISOString(),
      changedBy: 'SchedulingService',
      reason
    });

    db.saveAppointment(appt);
    return { success: true, appointment: appt };
  }

  /**
   * Cancels an existing appointment and releases slot back to bookable pool.
   */
  public cancelAppointment(appointmentId: string, reason: string): {
    success: boolean;
    appointment?: Appointment;
    error?: string;
  } {
    const appt = db.getAppointmentById(appointmentId);
    if (!appt) {
      return { success: false, error: `Appointment ${appointmentId} not found.` };
    }

    db.markSlotAvailable(appt.slotId);

    appt.status = 'Cancelled';
    appt.updatedAt = new Date().toISOString();
    appt.statusHistory.push({
      status: 'Cancelled',
      timestamp: new Date().toISOString(),
      changedBy: 'SchedulingService',
      reason
    });

    db.saveAppointment(appt);
    return { success: true, appointment: appt };
  }
}

export const schedulingService = new SchedulingService();
