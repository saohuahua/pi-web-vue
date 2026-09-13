import { defineStore } from "pinia";
import { reactive, ref } from "vue";
import type { SkillEntry } from "#shared/lib/types";

// 技能状态集中管理 详情页和快捷入口不会重复请求和更新
export const useSkillsStore = defineStore("skills", () => {
  const entries = ref<SkillEntry[]>([]);
  const loading = ref(false);
  const error = ref("");
  const updating = reactive(new Set<string>());

  async function load(cwd: string | null) {
    if (!cwd) {
      entries.value = [];
      error.value = "先在左侧选择项目";
      return;
    }
    loading.value = true;
    error.value = "";
    try {
      const res = await fetch(`/api/skills?cwd=${encodeURIComponent(cwd)}`);
      const body = await res.json() as { skills?: SkillEntry[]; error?: string };
      if (!res.ok || body.error) {
        entries.value = [];
        error.value = body.error ?? `HTTP ${res.status}`;
        return;
      }
      entries.value = body.skills ?? [];
    } catch (e) {
      entries.value = [];
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  async function setInvocation(skill: SkillEntry, allowed: boolean): Promise<boolean> {
    updating.add(skill.filePath);
    try {
      const res = await fetch("/api/skills", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filePath: skill.filePath, disableModelInvocation: !allowed }),
      });
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok || body.error) {
        error.value = body.error ?? `HTTP ${res.status}`;
        return false;
      }
      skill.disableModelInvocation = !allowed;
      error.value = "";
      return true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      return false;
    } finally {
      updating.delete(skill.filePath);
    }
  }

  return { entries, loading, error, updating, load, setInvocation };
});
