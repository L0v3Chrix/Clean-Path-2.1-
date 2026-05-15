import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { event, data, old_data, changed_fields } = payload;
    if (!data) return Response.json({ ok: true, skipped: 'no data' });

    const resident_id = data.resident_id || data.id;
    if (!resident_id) return Response.json({ ok: true, skipped: 'no resident_id' });

    const today = new Date().toISOString().split('T')[0];
    let milestone = null;

    // ── Resident status change ─────────────────────────────────────────────
    if (event?.entity_name === 'Resident' && changed_fields?.includes('status')) {
      const from = old_data?.status || '?';
      const to = data.status || '?';
      const labels = {
        applicant: 'Applicant', active: 'Active Resident', on_leave: 'On Leave',
        exited: 'Exited Program', alumni: 'Alumni'
      };
      milestone = {
        resident_id: data.id,
        organization_id: data.organization_id,
        date: today,
        type: 'status_change',
        source: 'auto',
        title: `Status: ${labels[from] || from} → ${labels[to] || to}`,
        description: `Resident status automatically updated from "${from}" to "${to}".`,
      };
    }

    // ── Interview completed ────────────────────────────────────────────────
    if (event?.entity_name === 'ResidentInterview' && data.status === 'completed') {
      const score = data.overall_score ? ` (Score: ${data.overall_score}/5)` : '';
      const rec = data.recommendation || 'pending';
      const recLabels = {
        approve: 'Approved', conditional_approve: 'Conditional Approval',
        waitlist: 'Waitlisted', deny: 'Denied', pending: 'Pending Review'
      };
      milestone = {
        resident_id: data.resident_id,
        organization_id: data.organization_id,
        date: data.interview_date || today,
        type: 'interview_completed',
        source: 'auto',
        title: `Interview Completed${score}`,
        description: `Conducted by ${data.conducted_by_name || 'Staff'} via ${(data.interview_mode || 'in_person').replace('_', ' ')}. Recommendation: ${recLabels[rec] || rec}.`,
      };
    }

    // ── Care plan goal completed ───────────────────────────────────────────
    if (event?.entity_name === 'CarePlanGoal' && data.status === 'completed' && old_data?.status !== 'completed') {
      milestone = {
        resident_id: data.resident_id,
        organization_id: data.organization_id,
        date: data.completed_date || today,
        type: 'care_plan_update',
        source: 'auto',
        title: `Care Plan Goal Achieved: ${data.title}`,
        description: `${data.term === 'short_term' ? 'Short-term' : 'Long-term'} goal in ${data.category || 'general'} completed.${data.progress_notes ? ' ' + data.progress_notes : ''}`,
      };
    }

    if (milestone) {
      await base44.asServiceRole.entities.ResidentMilestone.create(milestone);
      return Response.json({ ok: true, logged: milestone.title });
    }

    return Response.json({ ok: true, skipped: 'no matching condition' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});