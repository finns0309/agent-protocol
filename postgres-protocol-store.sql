create table if not exists ap_runs (
  id text primary key,
  world_id text not null,
  world_name text not null,
  runtime_profile text not null,
  status text not null,
  started_at_tick integer not null default 0,
  last_tick integer not null default 0,
  outcome jsonb
);

create table if not exists ap_agents (
  run_id text not null references ap_runs(id) on delete cascade,
  agent_id text not null,
  name text not null,
  directive text,
  presence text not null,
  state jsonb not null,
  primary key (run_id, agent_id)
);

create table if not exists ap_events (
  id text primary key,
  run_id text not null references ap_runs(id) on delete cascade,
  tick integer not null,
  type text not null,
  severity text not null,
  description text not null,
  agents_involved jsonb not null,
  data jsonb not null
);

create index if not exists ap_events_run_tick_idx on ap_events (run_id, tick);

create table if not exists ap_obligations (
  id text primary key,
  run_id text not null references ap_runs(id) on delete cascade,
  type text not null,
  issuer text not null,
  holder text not null,
  created_tick integer not null,
  due_tick integer,
  due_condition jsonb,
  settlement_rule text not null,
  failure_consequence text not null,
  status text not null,
  data jsonb not null
);

create table if not exists ap_relations (
  run_id text not null references ap_runs(id) on delete cascade,
  subject text not null,
  object text not null,
  type text not null,
  value jsonb not null,
  metadata jsonb not null,
  updated_tick integer not null,
  primary key (run_id, subject, object, type)
);

create table if not exists ap_snapshots (
  run_id text not null references ap_runs(id) on delete cascade,
  tick integer not null,
  reason text not null,
  payload jsonb not null,
  primary key (run_id, tick, reason)
);
