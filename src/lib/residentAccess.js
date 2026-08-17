export function getResidentInvitationEligibility(role, resident) {
  if (!['owner', 'admin'].includes(role)) {
    return { eligible: false, reason: 'Only owners and administrators can invite residents.' };
  }
  if (resident?.status !== 'active') {
    return { eligible: false, reason: 'Only active residents can receive account invitations.' };
  }
  if (resident.user_id) {
    return { eligible: false, reason: 'This resident already has a linked account.' };
  }
  if (!resident.email?.trim()) {
    return { eligible: false, reason: 'Add an email address to the resident profile before inviting them.' };
  }
  return { eligible: true, reason: null };
}

export function applyResidentAccountLink(resident, result) {
  if (!resident || resident.id !== result?.resident_id || !result.user_id) return resident;
  return { ...resident, user_id: result.user_id };
}

export function getResidentPortalLoadState({ loading, error, resident }) {
  if (loading) return 'loading';
  if (error) return 'error';
  return resident ? 'ready' : 'unlinked';
}
