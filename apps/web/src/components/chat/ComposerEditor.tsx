import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Editor, Node, mergeAttributes } from "@tiptap/core";
import { cn } from "../../lib/utils";
import {
  filterSkills,
  getSkillName,
  SkillPickerPanel,
  type SkillOption,
} from "./SkillPicker";

const SkillNode = Node.create({
  name: "skill",
  group: "inline",
  inline: true,
  selectable: false,
  atom: true,

  addAttributes() {
    return {
      name: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-skill-name"),
        renderHTML: (attributes) => ({
          "data-skill-name": attributes.name,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="skill"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(
        {
          "data-type": "skill",
          class: "skill-badge",
          contenteditable: "false",
        },
        HTMLAttributes,
      ),
      `/${node.attrs.name}`,
    ];
  },

  renderText({ node }) {
    return `<skill:${node.attrs.name}>`;
  },
});

interface ComposerEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  resetKey?: number;
  disabled?: boolean;
  placeholder?: string;
  minHeightClassName?: string;
  textClassName?: string;
  skills: SkillOption[];
}

export function ComposerEditor({
  value,
  onChange,
  onSubmit,
  resetKey = 0,
  disabled = false,
  placeholder = "按 / 使用技能，Shift+Enter 换行",
  minHeightClassName = "min-h-14",
  textClassName = "text-sm",
  skills,
}: ComposerEditorProps) {
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [skillPickerQuery, setSkillPickerQuery] = useState("");
  const [selectedSkillIndex, setSelectedSkillIndex] = useState(0);
  const lastEmittedValueRef = useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        bulletList: false,
        orderedList: false,
        horizontalRule: false,
      }),
      SkillNode,
    ],
    content: parseSkillTags(value),
    editable: !disabled,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "消息输入框",
        class: cn(
          "composer-editor-content max-h-60 overflow-y-auto break-words outline-none",
          minHeightClassName,
          textClassName,
        ),
      },
      handleKeyDown: (_view, event) => {
        if (skillPickerOpen) {
          const filteredSkills = filterSkills(skills, skillPickerQuery);
          if (event.key === "ArrowDown" && filteredSkills.length > 0) {
            event.preventDefault();
            setSelectedSkillIndex((current) => (current + 1) % filteredSkills.length);
            return true;
          }
          if (event.key === "ArrowUp" && filteredSkills.length > 0) {
            event.preventDefault();
            setSelectedSkillIndex((current) => (current - 1 + filteredSkills.length) % filteredSkills.length);
            return true;
          }
          if (event.key === "Enter") {
            event.preventDefault();
            const selectedSkill = filteredSkills[selectedSkillIndex];
            if (selectedSkill) {
              selectSkill(selectedSkill);
            }
            return true;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            closeSkillPicker();
            return true;
          }
        }

        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          const submittedValue = getTextFromView(_view);
          onSubmit(submittedValue);
          lastEmittedValueRef.current = "";
          editor?.commands.setContent("", { emitUpdate: false });
          closeSkillPicker();
          return true;
        }

        window.setTimeout(() => {
          syncValueFromView(_view);
          checkSkillTriggerFromView(_view);
        }, 0);

        return false;
      },
      handleDOMEvents: {
        beforeinput: (view, event) => {
          const inputEvent = event as InputEvent;
          if (inputEvent.inputType !== "insertText" || !inputEvent.data) return false;

          event.preventDefault();
          const { from, to } = view.state.selection;
          view.dispatch(view.state.tr.insertText(inputEvent.data, from, to));
          syncValueFromView(view);
          checkSkillTriggerFromView(view);
          return true;
        },
        input: (view) => {
          window.setTimeout(() => {
            syncValueFromView(view);
            checkSkillTriggerFromView(view);
          }, 0);
          return false;
        },
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const nextValue = currentEditor.getText();
      lastEmittedValueRef.current = nextValue;
      onChange(nextValue);
      checkSkillTrigger(currentEditor);
    },
    onBlur: () => {
      window.setTimeout(() => {
        closeSkillPicker();
      }, 150);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    const currentValue = editor.getText();
    if (currentValue === value) {
      lastEmittedValueRef.current = value;
      return;
    }
    if (value !== "" && lastEmittedValueRef.current === value) return;
    lastEmittedValueRef.current = value;
    editor.commands.setContent(parseSkillTags(value), { emitUpdate: false });
  }, [editor, value]);

  useEffect(() => {
    if (!editor || resetKey === 0) return;
    lastEmittedValueRef.current = "";
    editor.commands.setContent("", { emitUpdate: false });
    closeSkillPicker();
  }, [editor, resetKey]);

  function openSkillPicker(query: string) {
    setSkillPickerQuery(query);
    setSelectedSkillIndex(0);
    setSkillPickerOpen(true);
  }

  function closeSkillPicker() {
    setSkillPickerOpen(false);
    setSkillPickerQuery("");
    setSelectedSkillIndex(0);
  }

  function checkSkillTrigger(currentEditor: Editor) {
    const textBeforeCursor = currentEditor.getText();
    checkSkillTriggerFromText(textBeforeCursor);
  }

  function checkSkillTriggerFromView(view: Editor["view"]) {
    const textBeforeCursor = getTextFromView(view);
    checkSkillTriggerFromText(textBeforeCursor);
  }

  function syncValueFromView(view: Editor["view"]) {
    const nextValue = getTextFromView(view);
    lastEmittedValueRef.current = nextValue;
    onChange(nextValue);
  }

  function checkSkillTriggerFromText(textBeforeCursor: string) {
    const slashIndex = textBeforeCursor.lastIndexOf("/");

    if (slashIndex < 0) {
      closeSkillPicker();
      return;
    }

    const charBeforeSlash = textBeforeCursor[slashIndex - 1];
    if (slashIndex > 0 && charBeforeSlash !== " " && charBeforeSlash !== "\n") {
      closeSkillPicker();
      return;
    }

    const query = textBeforeCursor.slice(slashIndex + 1);
    if (/\s/.test(query)) {
      closeSkillPicker();
      return;
    }

    openSkillPicker(query);
  }

  function selectSkill(skill: SkillOption) {
    if (!editor) return;

    const { $from } = editor.state.selection;
    const textBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, "\n", "\n");
    const slashIndex = textBeforeCursor.lastIndexOf("/");
    if (slashIndex >= 0) {
      editor.chain().focus().deleteRange({ from: $from.start() + slashIndex, to: $from.pos }).run();
    }

    editor
      .chain()
      .focus()
      .insertContent({ type: "skill", attrs: { name: getSkillName(skill) } })
      .insertContent(" ")
      .run();
    closeSkillPicker();
    const nextValue = editor.getText();
    lastEmittedValueRef.current = nextValue;
    onChange(nextValue);
  }

  function getTextFromView(view: Editor["view"]) {
    return view.state.doc.textBetween(0, view.state.doc.content.size, "\n", (node) =>
      node.type.name === "skill" ? `<skill:${node.attrs.name}>` : "",
    );
  }

  return (
    <div className="relative">
      <SkillPickerPanel
        open={skillPickerOpen}
        skills={skills}
        query={skillPickerQuery}
        selectedIndex={selectedSkillIndex}
        onHover={setSelectedSkillIndex}
        onSelect={selectSkill}
      />
      <div
        className={cn(
          "relative rounded-md border-0 bg-transparent px-0 py-2 shadow-none",
          disabled && "cursor-not-allowed opacity-50",
        )}
        data-empty={!value.trim()}
      >
        {!value.trim() ? (
          <span className={cn("pointer-events-none absolute left-0 top-2 text-muted-foreground", textClassName)}>
            {placeholder}
          </span>
        ) : null}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function parseSkillTags(text: string): string {
  const escaped = escapeHtml(text);
  return escaped.replace(
    /&lt;skill:([^&]+)&gt;/g,
    '<span data-type="skill" data-skill-name="$1" class="skill-badge" contenteditable="false">/$1</span>',
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("\n", "<br>");
}
