from dagster import (
    DagsterInstance,
    DynamicPartitionsDefinition,
)

from data_pipeline.constants.environments import get_environment

user_partitions_def = DynamicPartitionsDefinition(name="users")


# Add test user to dev instance
if get_environment() == "LOCAL":
    instance = DagsterInstance.get()
    instance.add_dynamic_partitions(
        partitions_def_name=user_partitions_def.name,
        partition_keys=[
            "cm0i27jdj0000aqpa73ghpcxf",
            "cm0i27jdj0000aqpa73ghpcxd",
        ],
    )
