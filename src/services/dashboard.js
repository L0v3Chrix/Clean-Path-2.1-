import { appClient } from './appClient';

export const dashboardService = {
  residents: appClient.entities.Resident,
  locations: appClient.entities.Location,
  incidents: appClient.entities.IncidentReport,
  staff: appClient.entities.StaffMember,
  reflections: appClient.entities.MorningReflection,
};
