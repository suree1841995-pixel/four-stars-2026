-- ============================================================
--  FOUR STARS — Supabase Schema
--  วิธีใช้: Supabase Dashboard → SQL Editor → วางทั้งหมด → Run
-- ============================================================

-- 1. ตารางนักเรียน
create table if not exists players (
  id          serial primary key,
  number      integer not null,
  name        text not null,
  level       text not null check (level in ('มต้น','มปลาย')),
  room        text not null default '',
  created_at  timestamptz default now(),
  unique (number, level)
);

-- 2. ตารางการจัดโต๊ะ
create table if not exists table_assignments (
  id          serial primary key,
  game        integer not null,
  level       text not null,
  table_num   integer not null,
  sub_table   text not null,   -- '1A','1B' etc.
  player1_id  integer references players(id),
  player2_id  integer references players(id),
  is_bye      boolean default false,
  note        text default '',
  created_at  timestamptz default now(),
  unique (game, level, sub_table)
);

-- 3. ตารางผลการแข่งขัน (รอบคัดเลือก เกม 1-6)
--    rounds1/rounds2 = จำนวนรอบย่อยที่ชนะ (0-3, ปกติรวม=3)
create table if not exists games (
  id          serial primary key,
  game        integer not null,
  level       text not null,
  table_num   integer not null,
  sub_table   text not null,
  player1_id  integer references players(id),
  rounds1     numeric,         -- รอบย่อยที่ชนะ ฝั่ง 1 (0-3, .5 ได้ถ้าเสมอรอบย่อย)
  player2_id  integer references players(id),
  rounds2     numeric,         -- รอบย่อยที่ชนะ ฝั่ง 2
  saved_at    timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (game, level, sub_table)
);

-- 4. ตารางรอบชิงชนะเลิศ (ชิงที่ 1-2 และ 3-4)
create table if not exists finals (
  id          serial primary key,
  level       text not null,
  pair_label  text not null,   -- 'ชิงที่ 1-2' | 'ชิงที่ 3-4'
  player1_id  integer references players(id),
  rounds1     numeric,
  player2_id  integer references players(id),
  rounds2     numeric,
  saved_at    timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (level, pair_label)
);

-- 5. ตาราง broadcast (แจ้ง realtime จาก admin)
create table if not exists broadcast (
  id          serial primary key,
  type        text not null,
  level       text,
  payload     jsonb default '{}',
  created_at  timestamptz default now()
);

-- ============================================================
--  Enable Realtime
-- ============================================================
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table table_assignments;
alter publication supabase_realtime add table finals;
alter publication supabase_realtime add table broadcast;
