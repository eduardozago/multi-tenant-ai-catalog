import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription } from "@multi-tenant-ai-catalog/ui/components/alert";
import { Button } from "@multi-tenant-ai-catalog/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@multi-tenant-ai-catalog/ui/components/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@multi-tenant-ai-catalog/ui/components/field";
import { Input } from "@multi-tenant-ai-catalog/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@multi-tenant-ai-catalog/ui/components/select";
import { AlertCircle, Loader2, UserPlus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { PasswordInput } from "@/components/password-input";
import { ROLE_LABELS } from "@/components/role-badge";
import { applyFieldErrors, getErrorMessage } from "@/lib/form-errors";
import { ROLES } from "@/lib/permissions";

import { useCreateUser } from "../hooks";
import { type CreateUserInput, createUserSchema } from "../schemas";

const FIELDS = ["name", "email", "password", "role"] as const;
const EMPTY_FORM: CreateUserInput = { name: "", email: "", password: "", role: "user" };

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const createUser = useCreateUser();
  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: EMPTY_FORM,
  });
  const { errors } = form.formState;

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    // Start clean the next time it opens; never keep a typed password around.
    if (!next) {
      form.reset(EMPTY_FORM);
      setBannerError(null);
      createUser.reset();
    }
  };

  const submit = form.handleSubmit((input) => {
    setBannerError(null);
    createUser.mutate(input, {
      onSuccess: (user) => {
        toast.success("Usuário criado", { description: `${user.name} já pode entrar.` });
        onOpenChange(false);
      },
      onError: (error) => {
        if (!applyFieldErrors(error, form.setError, FIELDS)) setBannerError(getErrorMessage(error));
      },
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button />}>
        <UserPlus aria-hidden />
        Novo usuário
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>A pessoa entra com este email e senha na sua empresa.</DialogDescription>
          </DialogHeader>

          <FieldGroup>
            {bannerError && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{bannerError}</AlertDescription>
              </Alert>
            )}
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="new-user-name">Nome</FieldLabel>
              <Input
                id="new-user-name"
                autoComplete="off"
                autoFocus
                aria-invalid={!!errors.name}
                {...form.register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="new-user-email">Email</FieldLabel>
              <Input
                id="new-user-email"
                type="email"
                autoComplete="off"
                aria-invalid={!!errors.email}
                {...form.register("email")}
              />
              <FieldError errors={[errors.email]} />
            </Field>
            <Field data-invalid={!!errors.password}>
              <FieldLabel htmlFor="new-user-password">Senha inicial</FieldLabel>
              <PasswordInput
                id="new-user-password"
                // The admin types someone else's password: do not offer to save it as theirs.
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                {...form.register("password")}
              />
              <FieldError errors={[errors.password]} />
            </Field>
            <Field data-invalid={!!errors.role}>
              <FieldLabel htmlFor="new-user-role">Papel</FieldLabel>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Select
                    items={ROLE_LABELS}
                    value={field.value}
                    onValueChange={(value) => {
                      if (value) field.onChange(value);
                    }}
                  >
                    <SelectTrigger
                      id="new-user-role"
                      className="w-full"
                      aria-invalid={!!errors.role}
                      onBlur={field.onBlur}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[errors.role]} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Criar usuário
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
