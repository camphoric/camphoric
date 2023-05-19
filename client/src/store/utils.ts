import { CreateApiOptions } from '@reduxjs/toolkit/query/react';

type BuilderFn = Parameters<
  CreateApiOptions<any, any, any, any>['endpoints']
>[0];

export const factory = <ApiObjectName extends string, Builder extends BuilderFn>(builder: Builder) => {
  const getCreator = <R>(apiObjectName: ApiObjectName) =>
    builder.query<[R], Object | void>({
      query: (params: { [a: string]: string }) => {
        const path = `${apiObjectName.toLowerCase()}s/`;

        if (!params) return path;

        const searchParams = new URLSearchParams(Object.entries(params));
        searchParams.sort();
        const queryString = searchParams.toString();
        return queryString ? `${path}?${queryString}` : path;
      },
      providesTags: [apiObjectName],
    });

  const getByIdCreator = <R>(apiObjectName: ApiObjectName) =>
    builder.query<R, Scalar>({
      query: (id) => `${apiObjectName.toLowerCase()}s/${id}/`,
      providesTags: (result, error, id) => [{ type: apiObjectName, id }],
    });

  const updateCreator = <R extends { id: Scalar }>(
    apiObjectName: ApiObjectName,
    invalidatesTags?: Array<ApiObjectName>,
  ) =>
    builder.mutation<R, Partial<R> & Pick<R, 'id'>>({
      // note: an optional `queryFn` may be used in place of `query`
      query: ({ id, ...patch }) => ({
        url: `${apiObjectName.toLowerCase()}s/${id}/`,
        method: 'PATCH',
        body: patch,
      }),
      invalidatesTags: invalidatesTags || [apiObjectName],
    });

  const createCreator = <R extends {}>(
    apiObjectName: ApiObjectName,
    invalidatesTags?: Array<ApiObjectName>,
  ) =>
    builder.mutation<
      R,
      Omit<R, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>
    >({
      // note: an optional `queryFn` may be used in place of `query`
      query: (body) => ({
        url: `${apiObjectName.toLowerCase()}s/`,
        method: 'POST',
        body,
      }),
      invalidatesTags: invalidatesTags || [apiObjectName],
    });

  const deleteCreator = <R extends { id: Scalar }>(
    apiObjectName: ApiObjectName,
    invalidatesTags?: Array<ApiObjectName>,
  ) =>
    builder.mutation<R, { id: Scalar }>({
      // note: an optional `queryFn` may be used in place of `query`
      query: ({ id }) => ({
        url: `${apiObjectName.toLowerCase()}s/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: invalidatesTags || [apiObjectName],
    });

  return {
    getCreator,
    getByIdCreator,
    updateCreator,
    createCreator,
    deleteCreator,
  };
}
