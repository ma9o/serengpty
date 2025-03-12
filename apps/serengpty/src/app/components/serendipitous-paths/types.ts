import { getSerendipitousPaths } from '../../actions/getSerendipitousPaths';

export type UserPathsResponse = Awaited<ReturnType<typeof getSerendipitousPaths>>;

export type Path = UserPathsResponse[number]['serendipitousPaths'][number];