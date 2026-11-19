import type {
  BloodRequestResponse,
  PublicBloodRequestSummary,
} from './request.interface.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toPublicBloodRequestSummary = (request: any): PublicBloodRequestSummary => {
  const units = request.unitsRequired ?? request.unitsNeeded ?? 1;
  const neededAt = request.requiredAt ?? request.neededAt ?? new Date();

  return {
    id: request.id,
    patientName: request.patientName,
    bloodGroup: request.bloodGroup,
    unitsNeeded: units,
    unitsRequired: units,
    hospitalName: request.hospitalName,
    hospitalAddress: request.hospitalAddress,
    district: request.district,
    city: request.city,
    area: request.area ?? null,
    neededAt,
    requiredAt: neededAt,
    urgency: request.urgency,
    status: request.status,
    createdAt: request.createdAt,
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const toFullBloodRequestResponse = (request: any): BloodRequestResponse => {
  const units = request.unitsRequired ?? request.unitsNeeded ?? 1;
  const neededAt = request.requiredAt ?? request.neededAt ?? new Date();
  const contact = request.contactPerson ?? request.contactName ?? '';

  return {
    id: request.id,
    requesterId: request.requesterId,
    patientName: request.patientName,
    bloodGroup: request.bloodGroup,
    unitsNeeded: units,
    unitsRequired: units,
    hospitalName: request.hospitalName,
    hospitalAddress: request.hospitalAddress,
    district: request.district,
    city: request.city,
    area: request.area ?? null,
    latitude: request.latitude ?? null,
    longitude: request.longitude ?? null,
    contactName: contact,
    contactPerson: contact,
    contactPhone: request.contactPhone,
    neededAt,
    requiredAt: neededAt,
    urgency: request.urgency,
    status: request.status,
    details: request.details ?? null,
    rejectionReason: request.rejectionReason ?? null,
    cancellationReason: request.cancellationReason ?? null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    ...(request.requester
      ? {
          requester: {
            id: request.requester.id,
            name: request.requester.name,
            email: request.requester.email,
            phone: request.requester.phone ?? null,
          },
        }
      : {}),
    ...(Array.isArray(request.assignments)
      ? {
          assignments: request.assignments.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (a: any) => ({
              id: a.id,
              donorProfileId: a.donorProfileId,
              status: a.status,
              assignedAt: a.assignedAt,
              notes: a.notes ?? null,
              donorName: a.donorProfile?.user?.name,
              donorBloodGroup: a.donorProfile?.bloodGroup,
            })
          ),
        }
      : {}),
  };
};
