/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * A Compyle skill is a reusable instruction set for Compyle Brain, stored as a
 * Markdown file with a small YAML frontmatter block in .compyle/skills/. The
 * body becomes the system prompt when the skill is applied or tested.
 */

export interface ICompyleSkill {
	name: string;
	description: string;
	tags: string[];
	/** Trigger words that hint when the skill is relevant. */
	trigger: string[];
	/** Markdown instructions — used as the system prompt. */
	body: string;
}

export const COMPYLE_SKILLS_DIR_SETTING = 'compyle.skillStudio.skillsDir';
export const COMPYLE_SKILL_STUDIO_ENABLED_SETTING = 'compyle.skillStudio.enabled';
export const COMPYLE_SKILLS_DEFAULT_DIR = '.compyle/skills';

export function emptySkill(): ICompyleSkill {
	return { name: '', description: '', tags: [], trigger: [], body: '' };
}

function splitList(value: string): string[] {
	return value
		.replace(/^\[|\]$/g, '')
		.split(',')
		.map(s => s.trim().replace(/^['"]|['"]$/g, ''))
		.filter(Boolean);
}

/**
 * Parse a skill file. Frontmatter is a forgiving `key: value` subset of YAML
 * (name, description, tags, trigger); everything after the closing `---` is the
 * body. Files without frontmatter are treated as a pure body.
 */
export function parseSkill(content: string): ICompyleSkill {
	const skill = emptySkill();
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!match) {
		skill.body = content.trim();
		return skill;
	}

	const [, frontmatter, body] = match;
	for (const line of frontmatter.split(/\r?\n/)) {
		const kv = line.match(/^([a-zA-Z]+):\s*(.*)$/);
		if (!kv) {
			continue;
		}
		const key = kv[1].toLowerCase();
		const value = kv[2].trim();
		switch (key) {
			case 'name': skill.name = value.replace(/^['"]|['"]$/g, ''); break;
			case 'description': skill.description = value.replace(/^['"]|['"]$/g, ''); break;
			case 'tags': skill.tags = splitList(value); break;
			case 'trigger': skill.trigger = splitList(value); break;
		}
	}
	skill.body = body.trim();
	return skill;
}

export function serializeSkill(skill: ICompyleSkill): string {
	const lines = [
		'---',
		`name: ${skill.name}`,
		`description: ${skill.description}`,
		`tags: ${skill.tags.join(', ')}`,
		`trigger: ${skill.trigger.join(', ')}`,
		'---',
		'',
		skill.body.trim(),
		'',
	];
	return lines.join('\n');
}

/** Filesystem-safe file name (without extension) derived from a skill name. */
export function skillFileSlug(name: string): string {
	return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'skill';
}
