const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '../skills');
const MARKETING_SKILLS_RAW_BASE = 'https://raw.githubusercontent.com/coreyhaines31/marketingskills/main/skills';
const cache = new Map();

const LOCAL_SKILL_FILES = {
  'hook-writer': 'Hooks.md',
};

function sanitizeSkillName(skillName) {
  return String(skillName || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function readLocalMarketingSkill(safeName) {
  const candidates = [
    LOCAL_SKILL_FILES[safeName] && path.join(SKILLS_DIR, LOCAL_SKILL_FILES[safeName]),
    path.join(SKILLS_DIR, `${safeName}.md`),
    path.join(SKILLS_DIR, safeName, 'SKILL.md'),
  ].filter(Boolean);

  for (const filePath of candidates) {
    try {
      if (!fs.existsSync(filePath)) continue;
      const text = fs.readFileSync(filePath, 'utf8');
      if (text && text.trim().length > 200) {
        return { filePath, text };
      }
    } catch (error) {
      console.error(`Local marketing skill read failed (${filePath}):`, error);
    }
  }
  return null;
}

async function loadMarketingSkill(skillName) {
  const safeName = sanitizeSkillName(skillName);
  if (!safeName) throw new Error('Invalid skill name.');
  if (cache.has(safeName)) {
    return { ...cache.get(safeName), from_cache: true };
  }

  const local = readLocalMarketingSkill(safeName);
  if (local) {
    const skill = {
      name: safeName,
      source_url: local.filePath,
      text: local.text,
      fetched: true,
      from_local: true,
    };
    cache.set(safeName, skill);
    return skill;
  }

  const sourceUrl = `${MARKETING_SKILLS_RAW_BASE}/${safeName}/SKILL.md`;
  try {
    const response = await fetch(sourceUrl, {
      headers: { 'user-agent': 'viraladlibrary-marketing-skills' },
    });
    if (response.ok) {
      const text = await response.text();
      if (text && text.trim().length > 200) {
        const skill = {
          name: safeName,
          source_url: sourceUrl,
          text,
          fetched: true,
          from_local: false,
        };
        cache.set(safeName, skill);
        return skill;
      }
    }
  } catch (error) {
    console.error('Marketing skill fetch error:', error);
  }

  const fallback = { name: safeName, source_url: sourceUrl, text: '', fetched: false, from_local: false };
  cache.set(safeName, fallback);
  return fallback;
}

module.exports = {
  loadMarketingSkill,
  sanitizeSkillName,
};
