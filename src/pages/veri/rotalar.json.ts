import type { APIRoute } from 'astro';
import { toRouteOutline } from '@/application/dto/RouteOutline';
import { tourCatalog } from '@/composition/catalog';

/** Route outlines of every tour, fetched by the home page map only when it scrolls into view. */
export const GET: APIRoute = async () => {
  const tours = await tourCatalog.listTours();
  return new Response(JSON.stringify(tours.map(toRouteOutline)), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
