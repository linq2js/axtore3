import { gql, model } from "axtore";
import { hooks } from "axtore/react";
import { FormEvent, useRef } from "react";

export type Filter = { page: number; size: number };

export type Photo = {
  albumId: number;
  id: number;
  title: string;
  url: string;
  thumbnailUrl: string;
};

export type PaginatedPhotos = {
  items: Photo[];
  hasMore: boolean;
};

const appModel = model()
  .state("filter", { page: 0, size: 5 } satisfies Filter)
  .query(
    // use underscore as prefix to prevent access this query from outside model context
    "_paginatedPhotos",
    gql<Filter, { paginatedPhotos: Photo[] }>`
      query Photos($page: Int, $size: Int) {
        paginatedPhotos(page: $page, size: $size) @client {
          albumId
          id
          title
          url
          thumbnailUrl
        }
      }
    `
  )
  .query(
    // the query data has following structure: { photos: ReturnType<QueryFn> }
    "photos",
    async ({
      $_paginatedPhotos,
      $filter,
      lastData,
    }): Promise<PaginatedPhotos> => {
      // get current pagination info
      // this query is reactive, when `filter` state changed it also re-fetches
      const filter = $filter();
      const isFirstPage = filter.page === 0;
      // the idea is we append new items to last data whenever the query called
      // user might jump to first page so we need to reset loadedItems to empty
      const loadedPhotos = isFirstPage
        ? []
        : (lastData as PaginatedPhotos | undefined)?.items ?? [];
      const { paginatedPhotos } = await $_paginatedPhotos({
        page: filter.page,
        size: filter.size,
      });

      return {
        items: loadedPhotos.concat(paginatedPhotos),
        hasMore: paginatedPhotos.length >= filter.size,
      };
    },
    // use hardRefetch option to notify loading status to UI components
    { hardRefetch: true }
  )
  .mutation(
    "applyFilter",
    ({ $filter }, { page, ...newFilter }: Partial<Filter>) => {
      // using Immer update recipe to modify filter object directly
      $filter((filter) => {
        // if user change size, jump to first page
        if (
          typeof newFilter.size !== "undefined" &&
          typeof page === "undefined" &&
          newFilter.size !== filter.size
        ) {
          page = 0;
        }

        Object.assign(filter, { ...newFilter, page });
      });
    }
  );

const { useFilter, useApplyFilter, usePhotos } = hooks(appModel.meta);

const App = () => {
  const pageSizeRef = useRef<HTMLInputElement>(null);
  const filter = useFilter();
  const applyFilter = useApplyFilter();
  const { data, loading } = usePhotos();
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (pageSizeRef.current) {
      applyFilter({ size: parseInt(pageSizeRef.current.value, 10) });
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <input ref={pageSizeRef} type="text" defaultValue={filter.size} />
        <p></p>
      </form>
      {data?.photos.items.map((photo) => (
        <pre key={photo.id}>{JSON.stringify(photo)}</pre>
      ))}
      <button
        disabled={loading || !data?.photos.hasMore}
        onClick={() => applyFilter({ page: filter.page + 1 })}
      >
        {loading ? "Loading..." : "More"}
      </button>
    </>
  );
};

export { App };
