import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { location_id, organization_id, week_start_date } = await req.json();
    if (!location_id || !organization_id || !week_start_date) {
      return Response.json({ error: 'location_id, organization_id, and week_start_date are required' }, { status: 400 });
    }

    // Fetch active residents at this location
    const residents = await base44.entities.Resident.filter({
      location_id,
      organization_id,
      status: 'active',
    });

    if (!residents.length) {
      return Response.json({ error: 'No active residents found at this location' }, { status: 400 });
    }

    // Fetch active chore templates for this location
    const chores = await base44.entities.ChoreTemplate.filter({
      location_id,
      organization_id,
      active: true,
    });

    if (!chores.length) {
      return Response.json({ error: 'No active chore templates defined for this location' }, { status: 400 });
    }

    // Delete existing assignments for this week/location to allow re-generation
    const existing = await base44.entities.ChoreAssignment.filter({
      location_id,
      organization_id,
      week_label: `Week of ${week_start_date}`,
    });
    await Promise.all(existing.map(a => base44.entities.ChoreAssignment.delete(a.id)));

    // Determine rotation offset from how many past weeks exist (round-robin fairness)
    const allPast = await base44.entities.ChoreAssignment.filter({ location_id, organization_id });
    const rotationOffset = Math.floor(allPast.length / Math.max(chores.length, 1)) % residents.length;

    const weekLabel = `Week of ${week_start_date}`;
    const created = [];

    for (let i = 0; i < chores.length; i++) {
      const chore = chores[i];
      const residentIndex = (i + rotationOffset) % residents.length;
      const resident = residents[residentIndex];

      // Calculate due date based on frequency
      const startDate = new Date(week_start_date);
      let dueDate = new Date(startDate);
      if (chore.frequency === 'daily') {
        // Create one per day Mon-Sun
        for (let day = 0; day < 7; day++) {
          const d = new Date(startDate);
          d.setDate(startDate.getDate() + day);
          const dayResident = residents[(i + rotationOffset + day) % residents.length];
          const assignment = await base44.entities.ChoreAssignment.create({
            organization_id,
            location_id,
            chore_id: chore.id,
            chore_name: chore.name,
            resident_id: dayResident.id,
            resident_name: `${dayResident.first_name} ${dayResident.last_name}`,
            due_date: d.toISOString().split('T')[0],
            week_label: weekLabel,
            status: 'pending',
            area: chore.area,
            estimated_minutes: chore.estimated_minutes,
            instructions: chore.instructions,
          });
          created.push(assignment);
        }
        continue;
      }

      // weekly/biweekly/monthly — one assignment per chore
      const assignment = await base44.entities.ChoreAssignment.create({
        organization_id,
        location_id,
        chore_id: chore.id,
        chore_name: chore.name,
        resident_id: resident.id,
        resident_name: `${resident.first_name} ${resident.last_name}`,
        due_date: dueDate.toISOString().split('T')[0],
        week_label: weekLabel,
        status: 'pending',
        area: chore.area,
        estimated_minutes: chore.estimated_minutes,
        instructions: chore.instructions,
      });
      created.push(assignment);
    }

    return Response.json({ success: true, created: created.length, week: weekLabel });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});