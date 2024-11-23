export default class EventsManager {
  private static eventsListeners: {
    [key: string]: Array<(...args: any[]) => any>;
  } = {};

  public static emit(name: string, ...args: any[]): void {
    if (!this.eventsListeners[name]) return;
    this.eventsListeners[name].forEach((listener) => listener(...args));
  }

  public static registerEventListener = (name: string): MethodDecorator => {
    return function (
      target: any,
      propertyKey: string | symbol,
      descriptor: PropertyDescriptor,
    ) {
      if (!EventsManager.eventsListeners[name])
        EventsManager.eventsListeners[name] = [];
      EventsManager.eventsListeners[name].push(descriptor.value);
    };
  };
}

export const OnEvent = EventsManager.registerEventListener;
