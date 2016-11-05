export class DeferredPromise<T> {
  public promise: Promise<T>;
  public resolve: ((value: T) => any);
  public reject: ((error: any) => any);

  constructor() {
    this.promise = new Promise<T>((resolve: any, reject: any) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  then(callback: ((result: T) => any)): Promise<any> {
    return this.promise.then(callback);
  }

  catch(callback: ((error: any) => any)): Promise<any> {
    return this.promise.catch(callback);
  }
}