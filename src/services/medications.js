import { appClient } from './appClient';

export const medicationsService = appClient.entities.Medication;
export const medicationLogsService = appClient.entities.MedicationLog;
export const procurementRequestsService = appClient.entities.ProcurementRequest;
