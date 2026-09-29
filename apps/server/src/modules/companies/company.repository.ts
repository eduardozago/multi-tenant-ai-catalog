import { CompanyModel } from "./company.model";

export type Company = { id: string; name: string };

// Companies are the tenants, so lookups are by the company's own id (which always
// comes from the verified JWT or from a user already loaded in that tenant).
export class CompanyRepository {
  async create(name: string): Promise<Company> {
    const doc = await CompanyModel.create({ name });
    return { id: doc._id.toString(), name: doc.name };
  }

  async findById(companyId: string): Promise<Company | null> {
    const doc = await CompanyModel.findById(companyId).lean();
    return doc ? { id: doc._id.toString(), name: doc.name } : null;
  }

  /** Compensation step for registration (see D-10). */
  async deleteById(companyId: string): Promise<void> {
    await CompanyModel.deleteOne({ _id: companyId });
  }
}
