import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  attachRefreshedCookies,
  getAdminSupabase,
  getAuthenticatedSession,
  isSchemaMissingError,
  listUserProjects,
  saveUserProjectsFallback,
} from '@/lib/serverSupabase';
import type { ProjectRecord } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const { user, refreshedSession } = await getAuthenticatedSession(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const projects = await listUserProjects(user);
    const res = NextResponse.json({ projects });
    return attachRefreshedCookies(res, refreshedSession);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to load projects.' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, refreshedSession } = await getAuthenticatedSession(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Please sign in to create and save projects.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const description =
      typeof body?.description === 'string' ? body.description.trim() : '';
    const initialThesisId =
      typeof body?.thesisId === 'string' ? body.thesisId.trim() : '';
    const initialNote = typeof body?.note === 'string' ? body.note.trim() : '';

    if (!name) {
      return NextResponse.json({ error: 'Project name is required.' }, { status: 400 });
    }

    const admin = getAdminSupabase();
    const now = new Date().toISOString();

    const { data: created, error } = await admin
      .from('projects')
      .insert({
        user_id: user.id,
        name,
        description,
        updated_at: now,
      })
      .select('id, name, description, created_at, updated_at')
      .single();

    if (!error && created) {
      if (initialThesisId) {
        const { error: linkErr } = await admin.from('project_theses').upsert(
          {
            project_id: created.id,
            thesis_id: initialThesisId,
            note: initialNote,
            added_at: now,
          },
          { onConflict: 'project_id,thesis_id' }
        );
        if (linkErr && !isSchemaMissingError(linkErr)) throw linkErr;
      }
      const projects = await listUserProjects(user);
      const res = NextResponse.json({
        projectId: created.id,
        projects,
      });
      return attachRefreshedCookies(res, refreshedSession);
    }

    if (error && !isSchemaMissingError(error)) {
      throw error;
    }

    // Metadata fallback when relational projects tables are not yet migrated
    const current = await listUserProjects(user);
    const newProject: ProjectRecord = {
      id: randomUUID(),
      name,
      description,
      items: initialThesisId
        ? [{ thesisId: initialThesisId, note: initialNote, addedAt: now }]
        : [],
      createdAt: now,
      updatedAt: now,
    };
    const nextProjects = [newProject, ...current];
    await saveUserProjectsFallback(user, nextProjects);

    const res = NextResponse.json({
      projectId: newProject.id,
      projects: nextProjects,
    });
    return attachRefreshedCookies(res, refreshedSession);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to create project.' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { user, refreshedSession } = await getAuthenticatedSession(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Please sign in to modify project items.' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const action = typeof body?.action === 'string' ? body.action : 'upsert_thesis';
    const projectId = typeof body?.projectId === 'string' ? body.projectId : '';
    const thesisId = typeof body?.thesisId === 'string' ? body.thesisId : '';
    const note = typeof body?.note === 'string' ? body.note : '';
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const description =
      typeof body?.description === 'string' ? body.description.trim() : undefined;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 });
    }

    const admin = getAdminSupabase();
    const now = new Date().toISOString();

    const { data: ownProject, error: checkErr } = await admin
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!checkErr) {
      if (!ownProject) {
        return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
      }

      if (action === 'rename' && name) {
        await admin
          .from('projects')
          .update({
            name,
            ...(description !== undefined ? { description } : {}),
            updated_at: now,
          })
          .eq('id', projectId);
      } else if (action === 'remove_thesis' && thesisId) {
        await admin
          .from('project_theses')
          .delete()
          .eq('project_id', projectId)
          .eq('thesis_id', thesisId);
        await admin.from('projects').update({ updated_at: now }).eq('id', projectId);
      } else if (action === 'upsert_thesis' && thesisId) {
        await admin.from('project_theses').upsert(
          {
            project_id: projectId,
            thesis_id: thesisId,
            note,
            added_at: now,
          },
          { onConflict: 'project_id,thesis_id' }
        );
        await admin.from('projects').update({ updated_at: now }).eq('id', projectId);
      }

      const projects = await listUserProjects(user);
      const res = NextResponse.json({ projects });
      return attachRefreshedCookies(res, refreshedSession);
    }

    if (!isSchemaMissingError(checkErr)) {
      throw checkErr;
    }

    // Metadata fallback
    const current = await listUserProjects(user);
    const updated = current.map((proj) => {
      if (proj.id !== projectId) return proj;
      if (action === 'rename' && name) {
        return {
          ...proj,
          name,
          description: description !== undefined ? description : proj.description,
          updatedAt: now,
        };
      }
      if (action === 'remove_thesis' && thesisId) {
        return {
          ...proj,
          items: proj.items.filter((item) => item.thesisId !== thesisId),
          updatedAt: now,
        };
      }
      if (action === 'upsert_thesis' && thesisId) {
        const exists = proj.items.some((item) => item.thesisId === thesisId);
        const items = exists
          ? proj.items.map((item) =>
              item.thesisId === thesisId ? { ...item, note } : item
            )
          : [{ thesisId, note, addedAt: now }, ...proj.items];
        return { ...proj, items, updatedAt: now };
      }
      return proj;
    });

    await saveUserProjectsFallback(user, updated);
    const res = NextResponse.json({ projects: updated });
    return attachRefreshedCookies(res, refreshedSession);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to update project.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user, refreshedSession } = await getAuthenticatedSession(req);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const projectId = req.nextUrl.searchParams.get('projectId') || '';
    if (!projectId) {
      return NextResponse.json({ error: 'projectId query param is required.' }, { status: 400 });
    }

    const admin = getAdminSupabase();
    const { error } = await admin
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', user.id);

    if (!error) {
      const projects = await listUserProjects(user);
      const res = NextResponse.json({ projects });
      return attachRefreshedCookies(res, refreshedSession);
    }

    if (!isSchemaMissingError(error)) {
      throw error;
    }

    const current = await listUserProjects(user);
    const next = current.filter((proj) => proj.id !== projectId);
    await saveUserProjectsFallback(user, next);

    const res = NextResponse.json({ projects: next });
    return attachRefreshedCookies(res, refreshedSession);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to delete project.' },
      { status: 500 }
    );
  }
}

