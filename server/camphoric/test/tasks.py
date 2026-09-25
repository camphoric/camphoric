'''
A task backend for tests: tasks run as they're enqueued (like Django's
ImmediateBackend) and their errors fail the test, while a task deferred to a
future time waits until the test calls run_due_tasks().
'''

import dataclasses

from django.tasks import task_backends
from django.tasks.backends.immediate import ImmediateBackend
from django.tasks.base import TaskResult, TaskResultStatus
from django.utils import timezone
from django.utils.crypto import get_random_string


class TaskFailed(Exception):
    pass


class EagerTaskBackend(ImmediateBackend):
    supports_defer = True

    def __init__(self, alias, params):
        super().__init__(alias, params)
        self.deferred = []

    def enqueue(self, task, args, kwargs):
        if task.run_after is not None and task.run_after > timezone.now():
            self.validate_task(task)
            result = TaskResult(
                task=task, id=get_random_string(32), status=TaskResultStatus.READY,
                enqueued_at=timezone.now(), started_at=None, last_attempted_at=None,
                finished_at=None, args=args, kwargs=kwargs, backend=self.alias,
                errors=[], worker_ids=[],
            )
            self.deferred.append(result)
            return result

        result = super().enqueue(dataclasses.replace(task, run_after=None), args, kwargs)
        if result.status == TaskResultStatus.FAILED:
            raise TaskFailed(result.errors[0].traceback)
        return result

    def run_due(self):
        '''Run the deferred tasks that are due now; returns how many ran.'''
        now = timezone.now()
        due = sorted((r for r in self.deferred if r.task.run_after <= now),
                     key=lambda r: r.task.run_after)
        self.deferred = [r for r in self.deferred if r.task.run_after > now]
        for result in due:
            self.enqueue(dataclasses.replace(result.task, run_after=None),
                         result.args, result.kwargs)
        return len(due)


def run_due_tasks():
    '''Run every deferred task that's due (under freezegun, at the frozen time).'''
    return task_backends['default'].run_due()


def clear_deferred_tasks():
    task_backends['default'].deferred = []
