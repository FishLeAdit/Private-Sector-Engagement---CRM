import { expect,test } from "@playwright/test";
const id="f1000000-0000-4000-8000-000000000001";
test("contribution data and recording require authentication",async({request})=>{for(const path of["/api/contributions",`/api/contributions/${id}`]){const response=await request.get(path);expect(response.status()).toBe(401);expect(response.headers()["cache-control"]).toContain("no-store");}expect((await request.post("/api/contributions",{data:{amount:"100"}})).status()).toBe(401);});
test("contribution pages preserve sign-in return destinations",async({page})=>{for(const path of["/contributions","/contributions/new",`/contributions/${id}`]){await page.goto(path);await expect(page).toHaveURL(/\/login\?/);expect(new URL(page.url()).searchParams.get("next")).toBe(path);}});
