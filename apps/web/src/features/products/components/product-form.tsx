import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription } from "@multi-tenant-ai-catalog/ui/components/alert";
import { Button } from "@multi-tenant-ai-catalog/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@multi-tenant-ai-catalog/ui/components/field";
import { Input } from "@multi-tenant-ai-catalog/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@multi-tenant-ai-catalog/ui/components/input-group";
import { Textarea } from "@multi-tenant-ai-catalog/ui/components/textarea";
import { cn } from "@multi-tenant-ai-catalog/ui/lib/utils";
import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { ApiError } from "@/lib/api-client";
import { applyFieldErrors, getErrorMessage } from "@/lib/form-errors";
import { centsToPriceInput, maskPriceInput } from "@/lib/format";

import type { Product, UpdateProductInput } from "../api";
import { useCreateProduct, useUpdateProduct } from "../hooks";
import {
  DESCRIPTION_MAX_LENGTH,
  isHttpUrl,
  type ProductFormOutput,
  type ProductFormValues,
  productFormSchema,
} from "../schemas";
import { CategoryCombobox } from "./category-combobox";
import { ProductImage } from "./product-image";

const FIELDS = ["name", "description", "priceCents", "category", "imageUrl"] as const;

const EMPTY_FORM: ProductFormValues = {
  name: "",
  description: "",
  priceCents: "",
  category: "",
  imageUrl: "",
};

function toFormValues(product: Product): ProductFormValues {
  return {
    name: product.name,
    description: product.description,
    priceCents: centsToPriceInput(product.priceCents),
    category: product.category,
    imageUrl: product.imageUrl ?? "",
  };
}

export const PRODUCT_FORM_ID = "product-form";

/**
 * Create (`product` null) or edit. Rendered inside ProductFormSheet, which owns the submit
 * button placement; this component owns fields, validation and the request.
 */
export function ProductForm({
  product,
  onDirtyChange,
  onPendingChange,
  onSaved,
}: {
  product: Product | null;
  onDirtyChange: (dirty: boolean) => void;
  onPendingChange: (pending: boolean) => void;
  onSaved: () => void;
}) {
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const mutation = product ? updateProduct : createProduct;
  const [bannerError, setBannerError] = useState<string | null>(null);

  const form = useForm<ProductFormValues, unknown, ProductFormOutput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: product ? toFormValues(product) : EMPTY_FORM,
  });
  const { errors, isDirty, dirtyFields } = form.formState;

  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);
  useEffect(() => onPendingChange(mutation.isPending), [mutation.isPending, onPendingChange]);

  // Trimmed, like the server and the schema, so trailing spaces do not turn the counter red.
  const descriptionLength = form.watch("description").trim().length;
  const imageUrl = form.watch("imageUrl").trim();

  const onError = (error: unknown) => {
    if (applyFieldErrors(error, form.setError, FIELDS)) return;
    // A validation error that matches no field (e.g. a bad id) has nothing to highlight,
    // so "Revise os campos destacados" would point at nothing.
    const isUnmappedValidation = error instanceof ApiError && error.code === "VALIDATION_ERROR";
    setBannerError(
      isUnmappedValidation ? "Não foi possível salvar. Tente novamente." : getErrorMessage(error),
    );
  };

  const submit = form.handleSubmit((values) => {
    setBannerError(null);
    const fields = {
      name: values.name,
      description: values.description,
      priceCents: values.priceCents,
      category: values.category,
    };
    if (product) {
      // Only what this admin changed: omitted fields stay as they are on the server, so two
      // admins editing different fields do not overwrite each other with stale values.
      const input: UpdateProductInput = {};
      if (dirtyFields.name) input.name = fields.name;
      if (dirtyFields.description) input.description = fields.description;
      if (dirtyFields.priceCents) input.priceCents = fields.priceCents;
      if (dirtyFields.category) input.category = fields.category;
      // `null` is how PATCH removes an image; omitting it keeps the current one.
      if (dirtyFields.imageUrl) input.imageUrl = values.imageUrl || null;

      // Nothing changed: the server would reject an empty PATCH, and there is nothing to save.
      if (Object.keys(input).length === 0) {
        onSaved();
        return;
      }
      updateProduct.mutate({ id: product.id, input }, { onSuccess: onSaved, onError });
    } else {
      // Create has no "remove": an empty URL is simply not sent.
      createProduct.mutate(
        values.imageUrl ? { ...fields, imageUrl: values.imageUrl } : fields,
        { onSuccess: onSaved, onError },
      );
    }
  });

  return (
    <form id={PRODUCT_FORM_ID} onSubmit={submit} noValidate>
      <FieldGroup>
        {bannerError && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{bannerError}</AlertDescription>
          </Alert>
        )}

        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="product-name">Nome</FieldLabel>
          <Input
            id="product-name"
            autoComplete="off"
            autoFocus
            maxLength={120}
            aria-invalid={!!errors.name}
            {...form.register("name")}
          />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="product-description">Descrição</FieldLabel>
          <Textarea
            id="product-description"
            rows={4}
            className="max-h-60"
            aria-invalid={!!errors.description}
            aria-describedby="product-description-count"
            {...form.register("description")}
          />
          <FieldDescription
            id="product-description-count"
            className={cn(
              "text-right tabular-nums",
              descriptionLength > DESCRIPTION_MAX_LENGTH && "text-destructive",
            )}
          >
            {descriptionLength}/{DESCRIPTION_MAX_LENGTH}
          </FieldDescription>
          <FieldError errors={[errors.description]} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.priceCents}>
            <FieldLabel htmlFor="product-price">Preço</FieldLabel>
            <Controller
              control={form.control}
              name="priceCents"
              render={({ field }) => (
                <InputGroup>
                  <InputGroupAddon>
                    <InputGroupText>R$</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    id="product-price"
                    ref={field.ref}
                    name={field.name}
                    // Numeric keypad on mobile; the mask accepts digits only.
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0,00"
                    className="tabular-nums"
                    aria-invalid={!!errors.priceCents}
                    value={field.value}
                    onChange={(event) => field.onChange(maskPriceInput(event.target.value))}
                    onBlur={field.onBlur}
                  />
                </InputGroup>
              )}
            />
            <FieldError errors={[errors.priceCents]} />
          </Field>

          <Field data-invalid={!!errors.category}>
            <FieldLabel htmlFor="product-category">Categoria</FieldLabel>
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <CategoryCombobox
                  id="product-category"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={!!errors.category}
                />
              )}
            />
            <FieldError errors={[errors.category]} />
          </Field>
        </div>

        <Field data-invalid={!!errors.imageUrl}>
          <FieldLabel htmlFor="product-image-url">URL da imagem</FieldLabel>
          <Input
            id="product-image-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://…"
            aria-invalid={!!errors.imageUrl}
            {...form.register("imageUrl")}
          />
          <FieldDescription>Opcional. Sem imagem, o produto exibe um ícone.</FieldDescription>
          <FieldError errors={[errors.imageUrl]} />
          {/* Only a well-formed URL is requested; anything else previews the fallback. */}
          <ProductImage
            src={isHttpUrl(imageUrl) ? imageUrl : null}
            alt="Pré-visualização da imagem"
            className="max-w-48 border"
          />
        </Field>
      </FieldGroup>
    </form>
  );
}

export function ProductFormSubmit({ isEdit, pending }: { isEdit: boolean; pending: boolean }) {
  return (
    <Button type="submit" form={PRODUCT_FORM_ID} disabled={pending} className="flex-1">
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {isEdit ? "Salvar alterações" : "Criar produto"}
    </Button>
  );
}
