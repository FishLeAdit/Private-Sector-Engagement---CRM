// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DeleteMeetingButton } from "../../src/components/meetings/delete-meeting-button";
const navigation = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
const id = "30000000-0000-4000-8000-000000000099";
const show = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal"), close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype,"showModal",{ configurable:true,value(this:HTMLDialogElement){this.open=true;} }); Object.defineProperty(HTMLDialogElement.prototype,"close",{ configurable:true,value(this:HTMLDialogElement){this.open=false;} });
});
afterAll(() => { if(show)Object.defineProperty(HTMLDialogElement.prototype,"showModal",show);else Reflect.deleteProperty(HTMLDialogElement.prototype,"showModal");if(close)Object.defineProperty(HTMLDialogElement.prototype,"close",close);else Reflect.deleteProperty(HTMLDialogElement.prototype,"close"); });
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => { vi.clearAllMocks();fetcher=vi.fn().mockResolvedValue(Response.json({deleted:true,id}));vi.stubGlobal("fetch",fetcher); });
afterEach(() => { cleanup();vi.unstubAllGlobals(); });
function open() { render(<DeleteMeetingButton meetingId={id} title="Fictional deletion test" />);fireEvent.click(screen.getByRole("button",{name:"Delete meeting"})); }
describe("meeting deletion confirmation",()=>{
  it("names the meeting and cancels without a request",()=>{ open();expect(screen.getByText("Fictional deletion test")).toBeTruthy();expect(screen.getByText(/Audit history is retained/)).toBeTruthy();fireEvent.click(screen.getByRole("button",{name:"Cancel"}));expect(screen.queryByRole("dialog")).toBeNull();expect(fetcher).not.toHaveBeenCalled(); });
  it("requires explicit confirmation and returns to the meeting list",async()=>{ open();expect(fetcher).not.toHaveBeenCalled();fireEvent.click(screen.getByRole("button",{name:"Delete permanently"}));await waitFor(()=>expect(navigation.replace).toHaveBeenCalledWith("/meetings?deleted=1"));expect(fetcher).toHaveBeenCalledWith(`/api/meetings/${id}`,{method:"DELETE",cache:"no-store"});expect(navigation.refresh).toHaveBeenCalled(); });
  it("keeps linked-work conflicts visible",async()=>{fetcher.mockResolvedValueOnce(Response.json({error:"Linked follow-up tasks prevent deletion."},{status:409}));open();fireEvent.click(screen.getByRole("button",{name:"Delete permanently"}));expect((await screen.findByRole("alert")).textContent).toContain("follow-up");expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);expect(navigation.replace).not.toHaveBeenCalled();});
  it("blocks duplicate requests and Escape/cancel while pending",async()=>{let complete!:(response:Response)=>void;fetcher.mockImplementationOnce(()=>new Promise<Response>(resolve=>{complete=resolve;}));open();fireEvent.click(screen.getByRole("button",{name:"Delete permanently"}));const button=screen.getByRole("button",{name:"Deleting…"});expect((button as HTMLButtonElement).disabled).toBe(true);expect((screen.getByRole("button",{name:"Cancel"}) as HTMLButtonElement).disabled).toBe(true);fireEvent.click(button);const cancel=new Event("cancel",{cancelable:true});fireEvent(screen.getByRole("dialog"),cancel);expect(cancel.defaultPrevented).toBe(true);expect(fetcher).toHaveBeenCalledTimes(1);complete(Response.json({deleted:true,id}));await waitFor(()=>expect(navigation.replace).toHaveBeenCalled());});
});
