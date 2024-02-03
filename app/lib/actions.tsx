'use server';
import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

// FormSchema conforms with Invoice type definition from /app/lib/definitions.ts
const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer',
  }),
  amount: z.coerce.number().gt(0, {
    message: 'Please enter an amount greater than $0',
  }),
  // The amount field is specifically set to coerce (change)
  // from a string to a number while also validating its type.
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status',
  }),
  date: z.string(),
});

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

const CreateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(prevState: State, formData: FormData) {
  // Validate form using Zod
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  // If form validation fails, return errors early else continue
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing fields. Failed to create invoice.',
    };
  }

  // console.log(validatedFields);
  // {
  //   success: true,
  //   data: {
  //     customerId: '3958dc9e-712f-4377-85e9-fec4b6a6442a',
  //     amount: 145,
  //     status: 'paid'
  //   }
  // }

  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0]; // This creates date in the format "YYYY-MM-DD"

  // Inserting form data into the database
  try {
    await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
  `;
  } catch (error: any) {
    // console.error(error.message);
    // throw new Error('Database error: Failed to create invoice!');
    return { message: 'Database error: Failed to create invoice.' };
  }

  // Once the database has been updated, the /dashboard/invoices
  // path will be revalidated, and fresh data will be fetched from the server.
  // At this point, you also want to redirect the user back to the
  // /dashboard/invoices page. You can do this with the redirect function from Next.js
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function updateInvoice(
  id: string,
  prevState: State,
  formData: FormData,
) {
  // Validate form using Zod
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  // If form validation fails, return errors early else continue
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing fields or invalid amount. Failed to update invoice.',
    };
  }

  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;

  try {
    await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status=${status}
      WHERE id = ${id}
    `;
  } catch (error: any) {
    // console.error(error.message);
    // throw new Error('Database error: Failed to update invoice!');
    return { message: 'Database error: Failed to create invoice.' };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');

  // Similarly to the createInvoice action, here you are:

  // Extracting the data from formData.
  // Validating the types with Zod.
  // Converting the amount to cents.
  // Passing the variables to your SQL query.
  // Calling revalidatePath to clear the client cache and make a new server request.
  // Calling redirect to redirect the user to the invoice's page.
}

export async function deleteInvoice(id: string) {
  try {
    await sql`
    DELETE from invoices
    WHERE id = ${id}
  `;
    revalidatePath('/dashbaord/invoices');
  } catch (error: any) {
    console.error(error.message);
    throw new Error('Database error: Failed to delete invoice!');
  }
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}

// By adding the 'use server' (line 1), you mark all the exported
// functions within the file as server functions. These
// server functions can then be imported into Client and
// Server components, making them extremely versatile.
// You can also write Server Actions directly inside
// Server Components by adding "use server" inside the
// action. But for this course, we'll keep them all
// organized in a separate file.

// Tip: If you're working with forms that have many fields,
// you may want to consider using the entries() method with
// JavaScript's Object.fromEntries(). For example:
// const rawFormData = Object.fromEntries(formData.entries())

// Read up on FormData - https://developer.mozilla.org/en-US/docs/Web/API/FormData
// formData.get() - https://developer.mozilla.org/en-US/docs/Web/API/FormData/get

// Zod is a Typescript-first validation library
// We are importing Zod and defining a schema that matches
// the shape of our form object. This schema will validate
// the formData before saving it to the database.
