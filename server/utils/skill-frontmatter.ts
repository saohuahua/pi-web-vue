// Ported from pi-web lib/skill-frontmatter.ts — https://github.com/agegr/pi-web (MIT)
// 只改 disable-model-invocation 一个字段的手术式编辑
// 其余 YAML 原样保留 按存在性判断而不是真值
// 真值判断会重复插入同名键 整个文件无法解析 技能被加载器丢弃

import { parseFrontmatter } from "@earendil-works/pi-coding-agent";

const KEY = "disable-model-invocation";
const KEY_LINE = `[ \\t]*(?:${KEY}|"${KEY}"|'${KEY}')[ \\t]*:`;
const NEWLINE = "\\r\\n|\\n|\\r";

interface FrontmatterBlock {
  openingEnd: number;
  closingStart: number;
  newline: string;
}

function findFrontmatterBlock(content: string): FrontmatterBlock | undefined {
  const opening = new RegExp(`^\\uFEFF?---[ \\t]*(${NEWLINE})`).exec(content);
  if (!opening) return undefined;

  const rest = content.slice(opening[0].length);
  // SDK 在第一行 --- 处结束 frontmatter
  const closing = new RegExp(`(^|${NEWLINE})---`).exec(rest);
  if (!closing) return undefined;

  return {
    openingEnd: opening[0].length,
    closingStart: opening[0].length + closing.index + closing[1]!.length,
    newline: opening[1]!,
  };
}

function startsWithFrontmatterFence(content: string): boolean {
  const start = content.charCodeAt(0) === 0xfeff ? 1 : 0;
  return content.startsWith("---", start);
}

export function setDisableModelInvocation(content: string, disable: boolean): string {
  const { frontmatter } = parseFrontmatter<Record<string, unknown>>(content);
  const hasKey = Object.prototype.hasOwnProperty.call(frontmatter, KEY);
  if (!disable && !hasKey) return content;

  // 只在 frontmatter 块内编辑 正文里恰好写到该键的行不会被误改
  const block = findFrontmatterBlock(content);

  if (disable) {
    if (hasKey) {
      if (!block) throw new Error(`Cannot edit ${KEY}: unsupported frontmatter formatting`);
      const head = content.slice(block.openingEnd, block.closingStart);
      const keyLine = new RegExp(`(^|${NEWLINE})(${KEY_LINE})[^\\r\\n]*`);
      if (!keyLine.test(head)) throw new Error(`Cannot edit ${KEY}: unsupported frontmatter formatting`);
      const updated = head.replace(keyLine, "$1$2 true");
      return content.slice(0, block.openingEnd) + updated + content.slice(block.closingStart);
    }
    if (!block) {
      if (startsWithFrontmatterFence(content)) {
        throw new Error(`Cannot edit ${KEY}: unsupported frontmatter formatting`);
      }
      // 完全没有 frontmatter 时新建一个
      const bom = content.charCodeAt(0) === 0xfeff ? String.fromCharCode(0xfeff) : "";
      const body = bom ? content.slice(1) : content;
      return `${bom}---\n${KEY}: true\n---\n${body}`;
    }
    return (
      content.slice(0, block.openingEnd) +
      `${KEY}: true${block.newline}` +
      content.slice(block.openingEnd)
    );
  }

  if (!block) throw new Error(`Cannot edit ${KEY}: unsupported frontmatter formatting`);
  const head = content.slice(block.openingEnd, block.closingStart);
  // 保留前导换行并吃掉键自身行的换行 前后各保留恰好一个换行
  const keyLine = new RegExp(`(^|${NEWLINE})${KEY_LINE}[^\\r\\n]*(?:${NEWLINE}|$)`);
  if (!keyLine.test(head)) throw new Error(`Cannot edit ${KEY}: unsupported frontmatter formatting`);
  const updated = head.replace(keyLine, "$1");
  return content.slice(0, block.openingEnd) + updated + content.slice(block.closingStart);
}
