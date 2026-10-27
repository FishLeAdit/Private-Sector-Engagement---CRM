import "server-only";
import { createPageContext, loadPageData } from "@/lib/page-data";
import { createContactRepository } from "./queries";
import { createContactsService } from "./service";
import { ContactError } from "./types";

export const contactPageContext = () =>
  createPageContext((client, access) => createContactsService(createContactRepository(client), access));

export const contactPageData = <T>(load: () => Promise<T>) => loadPageData(ContactError, load);
