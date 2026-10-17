import { apiDelete, apiFetch } from "./client";

export type Invitation = {
	id: number;
	pet_id: number;
	code: string; // bare, e.g. "K7M2Q9RT"; use formatCode() to show it
	expires_at: string;
	created_at: string;
};

// Sharing a dog with a co-owner: the owner makes a one-time code, the other person enters it.
export const createInvitation = (petId: number) =>
	apiFetch<Invitation>(`/pets/${petId}/invitations`, { method: "POST" });

export const listInvitations = (petId: number) =>
	apiFetch<Invitation[]>(`/pets/${petId}/invitations`);

export const revokeInvitation = (petId: number, invitationId: number) =>
	apiDelete(`/pets/${petId}/invitations/${invitationId}`);

// Remove a co-owner (leaving yourself goes through PetContext.leavePet).
export const removeOwner = (petId: number, userId: number) =>
	apiFetch(`/pets/${petId}/users/${userId}`, { method: "DELETE" });
