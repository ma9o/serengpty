from typing import cast

from fsspec import AbstractFileSystem
from upath import UPath


def get_user_id_from_upath(file_upath: UPath) -> str:
    return file_upath.parent.parent.name


def get_checksum_from_upath(fs: AbstractFileSystem, file_upath: UPath) -> str:
    return fs.info(file_upath.path)["content_settings"]["content_md5"]


def validate_unique_input_checksum(file_upath: UPath) -> None:
    fs = file_upath.fs
    current_user_md5 = get_checksum_from_upath(fs, file_upath)

    glob_expr = file_upath.parent.parent.parent / "**" / "latest.json"
    current_user_id = get_user_id_from_upath(file_upath)

    # Check for duplicate files with the same MD5 hash in other user directories
    for file_path in cast(list[str], fs.glob(glob_expr.as_posix())):
        file_upath = UPath(file_path)
        user_id = get_user_id_from_upath(file_upath)

        # Skip current user
        if user_id == current_user_id:
            continue

        other_user_md5 = get_checksum_from_upath(fs, file_upath)

        if current_user_md5 == other_user_md5:
            raise ValueError(
                f"Duplicate file detected! File for user {current_user_id} has the same MD5 hash "
                f"({current_user_md5}) as file for user {user_id}. Aborting processing."
            )


if __name__ == "__main__":
    validate_unique_input_checksum(
        UPath(
            "az://enclaveid-production-bucket/api/cm8d6rryz0000l503ys5lj6uo/openai/latest.json"
        ),
    )
