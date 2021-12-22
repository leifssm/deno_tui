// Copyright 2021 Im-Beast. All rights reserved. MIT license.
import { CanvasInstance } from "./canvas.ts";
import { createEventEmitter, EventEmitter } from "./event_emitter.ts";
import { KeyPress, MultiKeyPress } from "./key_reader.ts";
import { TuiInstance } from "./tui.ts";
import { AnyComponent, TuiObject, TuiRectangle, TuiStyler } from "./types.ts";

/**
 * Extract TuiInstance from TuiObject
 * @param object - object from which TuiInstance will be extracted
 * @example
 * ```ts
 * const tui = createTui(...);
 * const component = createComponent(tui, ...);
 * ...
 * const a = getInstance(tui);
 * const b = getInstance(component);
 * // tui === a === b
 * ```
 */
export function getInstance(object: TuiInstance | AnyComponent): TuiInstance {
  return Object.hasOwn(object, "instance")
    ? (<TuiComponent> object).instance
    : object as TuiInstance;
}

export interface GetCurrentStylerOptions {
  /** Whether to overwrite focus value */
  focused?: {
    /**
     * Status for which `focus` will be overwritten
     * When `force` is set to false output will be OR'ed
     */
    value: boolean;
    /** Whether to force status */
    force?: boolean;
  };
  /** Whether to overwrite active value */
  active?: {
    /**
     * Status for which `active` will be overwritten
     * When `force` is set to false output will be OR'ed
     */
    value: boolean;
    /** Whether to force status */
    force?: boolean;
  };
}

/**
 * Get current CanvasStyler of component from TuiStyler
 * @param component - Component for which styler will be gotten
 * @param options
 * @example
 * ```ts
 * const tui = createTui(...);
 * ...
 * const component = createComponent(tui, ...);
 * component.styler = {
 *  foreground: "\x1b[32m",
 *  background: "\x1b[42m",
 *  active: {
 *    foreground: "\x1b[33m",
 *    background: "\x1b[43m",
 *  },
 *  focused: {
 *    foreground: "\x1b[34m",
 *    background: "\x1b[44m",
 *   }
 * };
 *
 * getCurrentStyler(component); // -> component.styler
 * getCurrentStyler(component, {
 *  focused: {
 *    value: true,
 *    force: true,
 *  }
 * }); // -> component.styler.focused
 *
 * tui.selected.item = component;
 * tui.selected.item.focused = true;
 * getCurrentStyler(component); // -> component.styler.focused
 *
 * tui.selected.item.active = true;
 * getCurrentStyler(component); // -> component.styler.active
 * ```
 */
export function getCurrentStyler(
  component: AnyComponent,
  options?: GetCurrentStylerOptions,
): TuiStyler {
  const styler = component.styler;
  const { item, focused, active } = component.instance.selected;

  const isSelected = (item?.id == component.id) ||
    component.focusedWithin.some(({ id }) => item?.id === id);
  const isFocused = options?.focused?.value ||
    (!options?.focused?.force && isSelected && focused);
  const isActive = options?.active?.value ||
    (!options?.active?.force && isSelected && active);

  if (isActive) {
    return {
      ...styler,
      ...styler.focused,
      ...styler.active,
    };
  } else if (isFocused) {
    return {
      ...styler,
      ...styler.focused,
    };
  }
  return styler;
}

/** TuiComponent that can be extended */
export type ExtendedTuiComponent<
  Name extends string = string,
  Extension = void,
  Events = void,
  EventDataType = void,
> = TuiComponent<Name, Events, EventDataType> & Extension;

/** Basic TuiComponent */
export type TuiComponent<
  Name extends string = string,
  Events = void,
  EventDataType = void,
> = {
  /** Unique ID for TuiComponent */
  readonly id: number;
  /** Component's EventEmitter */
  readonly emitter:
    & EventEmitter<"key", KeyPress>
    & EventEmitter<"multiKey", MultiKeyPress>
    & EventEmitter<"focus" | "active", undefined>
    & EventEmitter<Events extends string ? Events : never, EventDataType>;
  /** Handle given functions on specific component events */
  readonly on: TuiComponent<Name, Events, EventDataType>["emitter"]["on"];
  /** Handle given functions only once on specific component events */
  readonly once: TuiComponent<Name, Events, EventDataType>["emitter"]["once"];
  /** Disable handling specific functions on component events */
  readonly off: TuiComponent<Name, Events, EventDataType>["emitter"]["off"];
  /** Size and position of the component*/
  readonly rectangle: TuiRectangle;
  /** Definition of components look */
  readonly styler: TuiStyler;
  /** Component's name */
  name: Name;
  /** Function which draws component */
  draw: () => void;
  /** Function which runs before components are drawn */
  update: () => void;
  /** TuiInstance of component */
  instance: TuiInstance;
  /** Parent object of the component (TuiInstance or AnyComponent) */
  parent: TuiObject;
  /** Component's children components */
  children: AnyComponent[];
  /** Items which will gain components focus */
  focusedWithin: AnyComponent[];
  /** Canvas on which component will be drawn */
  canvas: CanvasInstance;

  /** Priority by which component will be drawn */
  drawPriority: number;
  /** Whether component is interactive */
  interactive: boolean;
};

export interface CreateComponentOptions<Name extends string = string> {
  /** Name of the component */
  name: Name;
  /** Definition of components look */
  styler?: TuiStyler;
  /** Size and position of the component*/
  rectangle: TuiRectangle;
  /** Whether component is interactive */
  interactive?: boolean;
  /** Items which will gain components focus */
  focusedWithin?: AnyComponent[];
  /** Function which draws component */
  draw?: () => void;
  /** Function which runs before components are drawn */
  update?: () => void;
  /** Priority by which component will be drawn */
  drawPriority?: number;
}

/**
 * "Destroy" component
 * - Disables all of its events
 * - Removes it from its parent and TuiInstance
 * - Removes all of its children (recurses)
 * @param component - component that will be removed
 * @example
 * ```ts
 * const component = createComponent(...);
 * ...
 * removeComponent(component);
 * ```
 */
export function removeComponent(component: AnyComponent) {
  const { parent, instance } = component;
  component.off("*");

  const filter = (
    comp: AnyComponent,
  ) => comp !== component;

  parent.children = parent.children.filter(filter);
  instance.components = instance.components.filter(filter);

  for (const child of component.children) {
    removeComponent(child);
  }
}

let componentId = 0;

/**
 * Create TuiComponent or ExtendedTuiComponent based whether `extension` is present
 * @param object - parent of the component
 * @param options
 * @param extension
 * @example look in `src/components/` dir for example components
 */
export function createComponent<
  Name extends string = string,
  Extension = void,
  Events = void,
  DataTypes = void,
>(
  object: TuiObject,
  {
    name,
    interactive = false,
    styler = object.styler,
    rectangle,
    focusedWithin = [],
    draw = () => {},
    update = () => {},
    drawPriority = 0,
  }: CreateComponentOptions<Name>,
  extension?: Extension,
): Extension extends void ? TuiComponent<Name, Events, DataTypes>
  : ExtendedTuiComponent<Name, Extension, Events, DataTypes> {
  const emitter = createEventEmitter() as TuiComponent<
    Name,
    Events,
    DataTypes
  >["emitter"];

  const instance = getInstance(object);

  const component: TuiComponent<Name, Events, DataTypes> = {
    id: componentId++,
    name,
    emitter,
    on: emitter.on,
    once: emitter.once,
    off: emitter.off,
    instance,
    rectangle,
    parent: object,
    children: [],
    focusedWithin,
    canvas: instance.canvas,
    styler,
    drawPriority,
    interactive,
    draw,
    update,
    ...extension,
  };

  instance.components.push(component);
  object.children.push(component);

  instance.components = instance.components.sort((b, a) =>
    b.drawPriority - a.drawPriority
  );

  return component as Extension extends void
    ? TuiComponent<Name, Events, DataTypes>
    : ExtendedTuiComponent<Name, Extension, Events, DataTypes>;
}
