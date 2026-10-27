// Isolated tests/benchmark driver, not the application's production cache backend.
import type { CacheBackend,CacheSpec } from "../../src/lib/cache/policy";
export class MeasurementCache implements CacheBackend{
 private entries=new Map<string,{value:unknown;tags:string[];expires:number}>();
 private generation=0;
 constructor(private now:()=>number=Date.now){}
 async get<T>(spec:CacheSpec,load:()=>Promise<T>):Promise<T>{const key=JSON.stringify(spec.key),entry=this.entries.get(key);if(entry&&entry.expires>this.now())return structuredClone(entry.value)as T;this.entries.delete(key);const version=this.generation,value=await load();if(version===this.generation)this.entries.set(key,{value:structuredClone(value),tags:spec.tags,expires:this.now()+spec.ttl*1000});return value;}
 invalidate(tag:string){this.generation++;for(const[key,entry]of this.entries)if(entry.tags.includes(tag))this.entries.delete(key);}
 values(){return[...this.entries.values()].map(e=>e.value);}
}
