// Copyright 2021 Im-Beast. All rights reserved. MIT license.
import { CanvasStyler, drawPixel, drawText } from "../canvas.ts";
import {
  createComponent,
  ExtendedTuiComponent,
  getCurrentStyler,
} from "../tui_component.ts";
import { TuiStyler } from "../types.ts";
import { TuiObject } from "../types.ts";
import { getStaticValue } from "../util.ts";
import { createBox, CreateBoxOptions } from "./box.ts";
import { textWidth } from "../util.ts";

/** Definition on how TextboxComponent should look like */
export type TextboxTuiStyler = TuiStyler & {
  cursor?: CanvasStyler;
};

/** Interactive textbox component */
export type TextboxComponent = ExtendedTuiComponent<
  "textbox",
  {
    /** Textbox content, each index of array starting by 1 represents newline */
    value: string[];
    /** `textbox.value` converted into a string using `textbox.value.join("\n")` */
    string: () => string;
    /** Whether textbox content is hidden by asteriks (*) */
    hidden: boolean;
    /** Whether textbox is multiline */
    multiline: boolean;
    /** Definition on how component looks like */
    styler: TextboxTuiStyler;
  },
  "valueChange",
  string[]
>;

export interface CreateTextboxOptions extends CreateBoxOptions {
  /** Textbox content, each index of array starting by 1 represents newline */
  value?: string[];
  /** Whether textbox content is hidden by asteriks (*) */
  hidden: boolean;
  /** Whether textbox is multiline */
  multiline: boolean;
  /** Definition on how component looks like */
  styler: TextboxTuiStyler;
}

/**
 * Create TextboxComponent
 *
 * It is interactive by default
 * @param object - parent of the created box, either Tui instance or other component
 * @param options
 * @example
 * ```ts
 * const tui = createTui(...);
 * ...
 * createTextbox(tui, {
 *  column: 1,
 *  row: 1,
 *  width: 10,
 *  height: 1,
 *  value: ["one line"],
 *  //multiline: true,
 *  //hidden: true,
 * })
 * ```
 */
export function createTextbox(
  object: TuiObject,
  options: CreateTextboxOptions,
): TextboxComponent {
  const position = { x: 0, y: 0 };

  const textbox: TextboxComponent = createComponent(object, {
    name: "textbox",
    interactive: true,
    draw() {
      const { row, column, width, height } = getStaticValue(
        textbox.rectangle,
      );

      const offsetX = position.x >= width ? position.x - width + 1 : 0;
      const offsetY = position.y >= height ? height - position.y - 1 : 0;

      for (let [i, line] of textbox.value.entries()) {
        const y = i + offsetY;
        if (y >= height || y < 0) continue;
        if (textbox.hidden) {
          line = "*".repeat(line.length);
        }

        line = line.slice(offsetX);

        let tw = textWidth(line);
        while (tw > width) {
          line = line.slice(0, -1);
          tw = textWidth(line);
        }

        drawText(object.canvas, {
          column,
          row: row + y,
          text: line,
          styler: getCurrentStyler(textbox),
        });
      }

      if (textbox.instance.selected.item?.id === textbox.id) {
        const currentCharacter = textbox.value?.[position.y]?.[position.x];
        const cursorCol = column + Math.min(position.x, width - 1);
        const cursorRow = row + Math.min(position.y, height - 1);
        drawPixel(object.canvas, {
          column: cursorCol,
          row: cursorRow,
          value: currentCharacter
            ? textbox.hidden ? "*" : currentCharacter
            : " ",
          styler: (getStaticValue<TextboxTuiStyler>(textbox.styler)?.cursor) ||
            { foreground: "\x1b[30m", background: "\x1b[47m" },
        });
      }
    },
    drawPriority: 1,
    ...options,
  }, {
    value: options?.value?.length ? options.value : [""],
    string: () => textbox.value.join("\n"),
    hidden: options.hidden,
    multiline: options.multiline,
  });

  createBox(textbox, {
    ...options,
    focusedWithin: [textbox, ...textbox.focusedWithin],
    styler: textbox.styler,
  });

  textbox.on("key", ({ key, shift, ctrl, meta }) => {
    if (!key || shift) return;

    const startValue = [...textbox.value];

    if (!ctrl && !meta && key.length === 1) {
      textbox.value[position.y] ||= "";
      textbox.value[position.y] =
        textbox.value[position.y].slice(0, position.x) + key +
        textbox.value[position.y].slice(position.x);
      ++position.x;
      textbox.emitter.emit("valueChange", startValue);
      return;
    }

    switch (key) {
      case "up":
        position.y = Math.max(0, position.y - 1);
        textbox.value[position.y] ||= "";
        position.x = textbox.value[position.y].length >= position.x
          ? position.x
          : textbox.value[position.y].length;
        break;
      case "down":
        position.y = Math.min(position.y + 1, textbox.value.length - 1);
        textbox.value[position.y] ||= "";
        position.x = textbox.value[position.y].length >= position.x
          ? position.x
          : textbox.value[position.y].length;
        break;
      case "left":
        position.x = Math.max(0, position.x - 1);
        break;
      case "right":
        position.x = Math.min(position.x + 1, textbox.value[position.y].length);
        break;
      case "return":
        if (position.x === textbox.value[position.y].length) {
          if (textbox.multiline) {
            textbox.value.splice(position.y + 1, 0, "");
          }
          position.y = Math.min(position.y + 1, textbox.value.length - 1);
          position.x = textbox.value[position.y].length;
        } else {
          const start = textbox.value[position.y].slice(0, position.x);
          const end = textbox.value[position.y].slice(position.x);
          textbox.value[position.y] = start;
          if (textbox.multiline) {
            textbox.value.splice(position.y + 1, 0, end);
          }
          position.y = Math.min(position.y + 1, textbox.value.length - 1);
          position.x = 0;
        }

        break;
      case "backspace":
        if (position.x === 0 && position.y !== 0) {
          position.y = Math.max(0, position.y - 1);
          const start = textbox.value[position.y] ?? "";
          const end = textbox.value.splice(position.y + 1, 1);
          if (end) {
            textbox.value[position.y] = start + end;
          }
          position.x = start.length;
        } else {
          textbox.value[position.y] ||= "";
          textbox.value[position.y] =
            textbox.value[position.y].substring(0, position.x - 1) +
            textbox.value[position.y].substring(position.x);
          position.x = Math.max(0, position.x - 1);
        }
        break;
      case "delete":
        if (position.x === textbox.value[position.y]?.length) {
          const del = textbox.value.splice(position.y, 1);
          if (del) {
            textbox.value[position.y] = del + (textbox.value[position.y] ?? "");
          }
        } else if (!textbox.value[position.y]?.length) {
          textbox.value.splice(position.y, 1);
        } else {
          textbox.value[position.y] =
            textbox.value[position.y].substring(0, position.x) +
            textbox.value[position.y].substring(position.x + 1);
        }
        break;
      case "home":
        position.x = 0;
        break;
      case "end":
        position.x = textbox.value[position.y].length;
        break;
      default:
        return;
    }

    textbox.emitter.emit("valueChange", startValue);
  });

  return textbox;
}
