export default class EventsManager {
  private static eventsListeners: {
    [key: string]: Array<(...args: any[]) => any>;
  } = {};

  public static emit(name: string, ...args: any[]): void {
    if (!this.eventsListeners[name]) return;
    this.eventsListeners[name].forEach((listener) => {
      try {
        listener(...args);
      } catch (error) {
        console.error(error);
      }
    });
  }

  public static registerEventListener = (name: string): MethodDecorator => {
    return function (
      target: any,
      propertyKey: string | symbol,
      descriptor: PropertyDescriptor,
    ) {
      if (!EventsManager.eventsListeners[name])
        EventsManager.eventsListeners[name] = [];
      const boundMethod = descriptor.value.bind(target);
      EventsManager.eventsListeners[name].push(boundMethod);
    };
  };
}

export const OnEvent = EventsManager.registerEventListener;
