<template>
  <div
    class="pane-resize-handle"
    :class="edge"
    role="separator"
    :aria-orientation="edge === 'top' ? 'horizontal' : 'vertical'"
    :aria-label="edge === 'right' ? '调整侧栏宽度' : edge === 'left' ? '调整文件预览宽度' : '调整文件区高度'"
    tabindex="0"
    @pointerdown="startResize"
    @keydown="resizeByKeyboard"
  ></div>
</template>

<script setup lang="ts">
const props = defineProps<{
  edge: "left" | "right" | "top";
  value: number;
  min: number;
  max: number;
}>();

const emit = defineEmits<{ "update:value": [value: number] }>();

function startResize(event: PointerEvent) {
  event.preventDefault();
  const startPoint = props.edge === "top" ? event.clientY : event.clientX;
  const startValue = props.value;
  document.body.classList.add("is-resizing-pane");
  document.body.classList.add(props.edge === "top" ? "is-resizing-height" : "is-resizing-width");

  const move = (moveEvent: PointerEvent) => {
    const point = props.edge === "top" ? moveEvent.clientY : moveEvent.clientX;
    const delta = point - startPoint;
    const next = props.edge === "right" ? startValue + delta : startValue - delta;
    emit("update:value", Math.max(props.min, Math.min(props.max, next)));
  };
  const end = () => {
    document.body.classList.remove("is-resizing-pane");
    document.body.classList.remove("is-resizing-height", "is-resizing-width");
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
  };

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", end);
}

function resizeByKeyboard(event: KeyboardEvent) {
  const vertical = props.edge === "top";
  if (vertical && event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
  if (!vertical && event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const direction = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : -1;
  const delta = vertical ? direction * 16 : props.edge === "right" ? direction * 16 : direction * -16;
  emit("update:value", Math.max(props.min, Math.min(props.max, props.value + delta)));
}
</script>
