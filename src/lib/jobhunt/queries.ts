export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  chartType?: 'bar' | 'pie' | 'none';
}

export interface QueryCategory {
  id: string;
  name: string;
  queries: SavedQuery[];
}

export const QUERY_CATEGORIES: QueryCategory[] = [
  {
    id: 'overview',
    name: 'Обзор',
    queries: [
      {
        id: 'summary',
        name: 'Сводка по таблицам',
        sql: `SELECT 'vacancies' AS "table", COUNT(*) AS total,
       COUNT(*) FILTER (WHERE archived_at IS NULL) AS active
FROM vacancies
UNION ALL
SELECT 'reserve_vacancies', COUNT(*), COUNT(*) FILTER (WHERE archived_at IS NULL)
FROM reserve_vacancies
UNION ALL
SELECT 'analytics_vacancies', COUNT(*), COUNT(*) FILTER (WHERE archived_at IS NULL)
FROM analytics_vacancies
UNION ALL
SELECT 'raw_messages', COUNT(*), COUNT(*) FILTER (WHERE status = 'pending')
FROM raw_messages`,
      },
      {
        id: 'statuses',
        name: 'Вакансии по статусам',
        sql: `SELECT status, COUNT(*) AS count
FROM vacancies WHERE archived_at IS NULL
GROUP BY status ORDER BY count DESC`,
        chartType: 'bar',
      },
    ],
  },
  {
    id: 'targets',
    name: 'Целевые',
    queries: [
      {
        id: 'targets_week',
        name: 'Таргеты за неделю',
        sql: `SELECT id, title, company, country, city, relevance_score,
       seniority_level, work_format, source_name, url,
       created_at::date AS date
FROM vacancies
WHERE created_at >= NOW() - INTERVAL '7 days' AND archived_at IS NULL
ORDER BY relevance_score DESC, created_at DESC`,
      },
      {
        id: 'targets_new',
        name: 'Новые (не просмотрены)',
        sql: `SELECT id, title, company, country, city, relevance_score,
       seniority_level, work_format, source_name, url, created_at
FROM vacancies
WHERE status = 'new' AND archived_at IS NULL
ORDER BY relevance_score DESC, created_at DESC
LIMIT 50`,
      },
      {
        id: 'targets_saved',
        name: 'Сохранённые',
        sql: `SELECT id, title, company, country, relevance_score, url, created_at
FROM vacancies
WHERE status = 'saved' AND archived_at IS NULL
ORDER BY created_at DESC`,
      },
      {
        id: 'targets_applied',
        name: 'Applied',
        sql: `SELECT id, title, company, country, relevance_score, url, created_at, updated_at
FROM vacancies
WHERE status = 'applied' AND archived_at IS NULL
ORDER BY updated_at DESC`,
      },
    ],
  },
  {
    id: 'geography',
    name: 'География',
    queries: [
      {
        id: 'geo_countries_target',
        name: 'Страны (целевые)',
        sql: `SELECT country, COUNT(*) AS count
FROM vacancies
WHERE archived_at IS NULL AND country != ''
GROUP BY country ORDER BY count DESC`,
        chartType: 'bar',
      },
      {
        id: 'geo_countries_all',
        name: 'Страны по всем таблицам',
        sql: `SELECT country, 'target' AS type, COUNT(*) AS count
FROM vacancies WHERE archived_at IS NULL AND country != '' GROUP BY country
UNION ALL
SELECT country, 'reserve', COUNT(*)
FROM reserve_vacancies WHERE archived_at IS NULL AND country != '' GROUP BY country
UNION ALL
SELECT country, 'analytics', COUNT(*)
FROM analytics_vacancies WHERE archived_at IS NULL AND country != '' GROUP BY country
ORDER BY count DESC`,
        chartType: 'bar',
      },
      {
        id: 'geo_cities',
        name: 'Города (топ-20)',
        sql: `SELECT country, city, COUNT(*) AS count
FROM vacancies
WHERE archived_at IS NULL AND city != ''
GROUP BY country, city ORDER BY count DESC LIMIT 20`,
        chartType: 'bar',
      },
    ],
  },
  {
    id: 'stack',
    name: 'Аналитика стека',
    queries: [
      {
        id: 'stack_languages',
        name: 'Топ языков (analytics)',
        sql: `SELECT primary_language, COUNT(*) AS count
FROM analytics_vacancies
WHERE archived_at IS NULL AND primary_language != ''
GROUP BY primary_language ORDER BY count DESC LIMIT 20`,
        chartType: 'bar',
      },
      {
        id: 'stack_techs_all',
        name: 'Топ технологий (все таблицы)',
        sql: `WITH all_stacks AS (
  SELECT jsonb_array_elements_text(parsed_stack) AS tech FROM vacancies
  WHERE parsed_stack IS NOT NULL AND archived_at IS NULL
  UNION ALL
  SELECT jsonb_array_elements_text(parsed_stack) FROM reserve_vacancies
  WHERE parsed_stack IS NOT NULL AND archived_at IS NULL
  UNION ALL
  SELECT jsonb_array_elements_text(parsed_stack) FROM analytics_vacancies
  WHERE parsed_stack IS NOT NULL AND archived_at IS NULL
)
SELECT tech, COUNT(*) AS count FROM all_stacks
GROUP BY tech ORDER BY count DESC LIMIT 30`,
        chartType: 'bar',
      },
      {
        id: 'stack_techs_target',
        name: 'Технологии в целевых',
        sql: `SELECT jsonb_array_elements_text(parsed_stack) AS tech, COUNT(*) AS count
FROM vacancies
WHERE parsed_stack IS NOT NULL AND archived_at IS NULL
GROUP BY tech ORDER BY count DESC LIMIT 20`,
        chartType: 'bar',
      },
      {
        id: 'work_format',
        name: 'Формат работы',
        sql: `SELECT work_format, COUNT(*) AS count
FROM vacancies WHERE archived_at IS NULL
GROUP BY work_format ORDER BY count DESC`,
        chartType: 'pie',
      },
    ],
  },
  {
    id: 'reserve',
    name: 'Резерв',
    queries: [
      {
        id: 'reserve_list',
        name: 'Резервные вакансии',
        sql: `SELECT id, title, company, country, city, seniority_level,
       relevance_score, source_name, url, created_at
FROM reserve_vacancies
WHERE archived_at IS NULL
ORDER BY relevance_score DESC, created_at DESC
LIMIT 50`,
      },
      {
        id: 'reserve_breakdown',
        name: 'Резерв: seniority + страна',
        sql: `SELECT seniority_level, country, COUNT(*) AS count
FROM reserve_vacancies WHERE archived_at IS NULL
GROUP BY seniority_level, country ORDER BY count DESC`,
        chartType: 'bar',
      },
      {
        id: 'reserve_seniority',
        name: 'Резерв по seniority',
        sql: `SELECT seniority_level, COUNT(*) AS count
FROM reserve_vacancies WHERE archived_at IS NULL
GROUP BY seniority_level ORDER BY count DESC`,
        chartType: 'pie',
      },
    ],
  },
  {
    id: 'sources',
    name: 'Источники',
    queries: [
      {
        id: 'sources_active',
        name: 'Активные источники',
        sql: `SELECT s.id, s.name, s.country, s.type, s.is_active,
       COUNT(v.id) AS vacancy_count
FROM sources s
LEFT JOIN vacancies v ON v.source_id = s.id AND v.archived_at IS NULL
GROUP BY s.id ORDER BY vacancy_count DESC`,
      },
      {
        id: 'sources_volume',
        name: 'Источники по объёму',
        sql: `SELECT source_name, COUNT(*) AS count, 'target' AS type
FROM vacancies WHERE archived_at IS NULL GROUP BY source_name
UNION ALL
SELECT source_name, COUNT(*), 'reserve'
FROM reserve_vacancies WHERE archived_at IS NULL GROUP BY source_name
UNION ALL
SELECT source_name, COUNT(*), 'analytics'
FROM analytics_vacancies WHERE archived_at IS NULL GROUP BY source_name
ORDER BY count DESC`,
      },
    ],
  },
];
