// Copyright 2023 Im-Beast. All rights reserved. MIT license.
import { DrawObject, DrawObjectOptions } from "./draw_object.ts";
import { BaseSignal } from "../signals.ts";

import type { Rectangle } from "../types.ts";
import { signalify } from "../utils/signals.ts";

export interface BoxObjectOptions extends DrawObjectOptions {
  rectangle: Rectangle | BaseSignal<Rectangle>;
  filler?: string | BaseSignal<string>;
}

export class BoxObject extends DrawObject<"box"> {
  filler: BaseSignal<string>;

  constructor(options: BoxObjectOptions) {
    super("box", options);

    this.rectangle = signalify(options.rectangle);
    this.filler = signalify(options.filler ?? " ");
  }

  rerender(): void {
    const { canvas, rerenderCells, omitCells } = this;
    const { frameBuffer, rerenderQueue } = canvas;
    const { rows, columns } = canvas.size.peek();

    const rectangle = this.rectangle.peek();
    const style = this.style.peek();
    const filler = this.filler.peek();

    let rowRange = Math.min(rectangle.row + rectangle.height, rows);
    let columnRange = Math.min(rectangle.column + rectangle.width, columns);

    const viewRectangle = this.view.peek()?.rectangle;
    if (viewRectangle) {
      rowRange = Math.min(rowRange, viewRectangle.row + viewRectangle.height);
      columnRange = Math.min(columnRange, viewRectangle.column + viewRectangle.width);
    }

    for (let row = rectangle.row; row < rerenderCells.length; ++row) {
      if (!(row in rerenderCells)) continue;
      else if (row >= rowRange) continue;

      const rerenderColumns = rerenderCells[row];
      if (!rerenderColumns) break;

      const omitColumns = omitCells[row];

      if (omitColumns?.size === rectangle.width) {
        omitColumns?.clear();
        continue;
      }

      const rowBuffer = frameBuffer[row] ??= [];
      const rerenderQueueRow = rerenderQueue[row] ??= new Set();

      for (const column of rerenderColumns) {
        if (omitColumns?.has(column) || column < rectangle.column || column >= columnRange) {
          continue;
        }

        rowBuffer[column] = style(filler);
        rerenderQueueRow.add(column);
      }

      rerenderColumns.clear();
      omitColumns?.clear();
    }
  }
}
