import type { Database } from './database';

type PublicSchema = Database['public'];

export type UserRole = PublicSchema['Enums']['user_role'];
export type TaskStatus = PublicSchema['Enums']['task_status'];

export type Profile = PublicSchema['Tables']['profiles']['Row'];
export type Site = PublicSchema['Tables']['sites']['Row'];
export type Task = PublicSchema['Tables']['tasks']['Row'];
export type TaskHistoryEntry = PublicSchema['Tables']['task_status_history']['Row'];

export type AvailableTransition =
  PublicSchema['Functions']['get_available_transitions']['Returns'][number];
