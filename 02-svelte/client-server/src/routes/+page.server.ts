import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ getClientAddress }) => {
	return {
		// This value is created on the server before HTML is sent to the browser.
		serverTime: new Date().toLocaleTimeString('es-MX'),
		clientAddress: getClientAddress()
	};
};

export const actions = {
	greet: async ({ request }) => {
		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';

		if (!name) {
			return fail(400, {
				missing: true,
				name
			});
		}

		return {
			success: true,
			name,
			message: `¡Hola, ${name}! Esta respuesta fue creada en el servidor.`,
			answeredAt: new Date().toLocaleTimeString('es-MX')
		};
	}
} satisfies Actions;
