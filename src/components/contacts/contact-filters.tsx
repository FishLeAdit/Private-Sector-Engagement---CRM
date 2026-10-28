"use client";

import { useState } from "react";
import Link from "next/link";
import type { ContactListInput } from "@/features/contacts/schemas";
import type { CompanyOption } from "@/features/contacts/types";
import { CompanyPicker } from "./company-picker";

export function ContactFilters({ input, company }: { input: ContactListInput; company?: CompanyOption | null }) {
  const [companyId, setCompanyId] = useState(input.company_id);
  return (
    <form
      method="get"
      action="/contacts"
      className="mb-6 grid items-start gap-4 panel p-4 sm:grid-cols-2 xl:grid-cols-[2fr_1fr_2fr_auto]"
    >
      <div>
        <label htmlFor="contact-search" className="mb-2 block text-sm font-medium">
          Search contacts
        </label>
        <input
          id="contact-search"
          name="q"
          type="search"
          className="input input-bordered w-full"
          defaultValue={input.q}
          maxLength={100}
          placeholder="Name, email, phone or workplace details"
        />
      </div>
      <div>
        <label htmlFor="contact-type-filter" className="mb-2 block text-sm font-medium">
          Type
        </label>
        <select
          id="contact-type-filter"
          name="kind"
          className="select select-bordered w-full"
          defaultValue={input.kind}
        >
          <option value="all">All contacts</option>
          <option value="individual">Individuals</option>
          <option value="company">Companies</option>
        </select>
      </div>
      <CompanyPicker value={companyId} onChange={setCompanyId} initial={company} />
      <div className="flex gap-2 sm:pt-7">
        <button type="submit" className="btn btn-primary">
          Apply
        </button>
        <Link href="/contacts" className="btn btn-ghost">
          Reset
        </Link>
      </div>
    </form>
  );
}
