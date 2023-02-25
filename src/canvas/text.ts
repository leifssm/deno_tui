import { Canvas } from "./canvas.ts";
import { DrawObject, DrawObjectOptions } from "./draw_object.ts";

import { textWidth } from "../utils/strings.ts";
import { fitsInRectangle, rectangleEquals, rectangleIntersection } from "../utils/numbers.ts";

import type { Rectangle } from "../types.ts";

export interface DrawTextOptions extends DrawObjectOptions {
  value: string;
  rectangle: {
    column: number;
    row: number;
  };
}

export class TextObject extends DrawObject<"text"> {
  value: string;
  previousValue!: string;

  constructor(options: DrawTextOptions) {
    super("text", options);
    this.value = options.value;
    // This gets filled with width and height in `update()`
    this.rectangle = options.rectangle as Rectangle;
    this.update();
  }

  updateMovement(): void {
    const { rectangle, previousRectangle, objectsUnder } = this;

    // Rerender cells that changed because objects position changed
    if (previousRectangle && !rectangleEquals(rectangle, previousRectangle)) {
      const intersection = rectangleIntersection(rectangle, previousRectangle, true);
      {
        const r = previousRectangle.row;
        for (let c = previousRectangle.column; c < previousRectangle.column + previousRectangle.width; ++c) {
          if (intersection && fitsInRectangle(c, r, intersection)) {
            continue;
          }

          for (const objectUnder of objectsUnder) {
            objectUnder.queueRerender(r, c);
          }
        }
      }

      {
        const r = rectangle.row;
        for (let c = rectangle.column; c < rectangle.column + rectangle.width; ++c) {
          // When text moves it needs to be rerendered completely because of text continuity
          this.queueRerender(r, c);

          if (intersection && fitsInRectangle(c, r, intersection)) {
            continue;
          }

          for (const objectUnder of objectsUnder) {
            objectUnder.queueRerender(r, c);
          }
        }
      }
    }
  }

  update(): void {
    super.update();

    const { value, previousValue } = this;
    if (value === previousValue) return;

    const { rectangle } = this;

    if (this.rendered) {
      for (let i = 0; i < value.length; ++i) {
        if (value[i] !== previousValue[i]) {
          this.queueRerender(rectangle.row, rectangle.column + i);
        }
      }
    }

    rectangle.width = textWidth(value);
    rectangle.height = 1;
    this.previousValue = value;
  }

  render(canvas: Canvas): void {
    const { style, value, rectangle, omitCells } = this;
    const { columns, rows } = canvas.size;
    const { frameBuffer, rerenderQueue } = canvas;

    const { row, column: startColumn } = rectangle;
    if (row < 0 || row >= rows) return;

    const omitColumns = omitCells[row];

    if (omitColumns?.size === rectangle.width) {
      omitColumns?.clear();
      return;
    }

    const rowBuffer = frameBuffer[row];
    const rerenderQueueRow = rerenderQueue[row] ??= new Set();

    for (let c = 0; c < value.length; ++c) {
      const column = startColumn + c;

      if (column < 0) continue;
      else if (column >= columns) break;

      if (omitColumns?.has(column)) {
        continue;
      }

      rowBuffer[column] = style(value[c]);
      rerenderQueueRow.add(column);
    }

    omitColumns?.clear();
  }

  rerender(canvas: Canvas): void {
    const { style, value, rectangle, omitCells, rerenderCells } = this;
    const { columns, rows } = canvas.size;
    const { frameBuffer, rerenderQueue } = canvas;

    const { row } = rectangle;

    const rerenderColumns = rerenderCells[row];
    if (!rerenderColumns) return;

    const omitColumns = omitCells[row];

    if (omitColumns?.size === rectangle.width) {
      omitColumns?.clear();
      return;
    }

    if (row < 0 || row >= rows) return;

    const rowBuffer = frameBuffer[row];
    const rerenderQueueRow = rerenderQueue[row] ??= new Set();

    for (const column of rerenderColumns) {
      if (
        column < 0 || column >= columns ||
        column < rectangle.column || column >= rectangle.column + rectangle.width ||
        omitColumns?.has(column)
      ) {
        continue;
      }

      rowBuffer[column] = style(value[column - rectangle.column]);
      rerenderQueueRow.add(column);
    }

    rerenderColumns.clear();
    omitColumns?.clear();
  }
}
